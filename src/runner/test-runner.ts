import { chromium, Browser, devices } from '@playwright/test';
import chalk from 'chalk';
import path from 'path';
import os from 'os';
import { config as dotenvConfig } from 'dotenv';
import { loadConfigs, loadTemplate } from '../utils/file-handler';
import { DataLoader } from '../utils/data-loader';
import { StepExecutor } from './executor';
import { Reporter } from './reporter';
import { TestConfig } from '../types/config';

// Load environment variables from .env file
dotenvConfig();

// Helper: Parse concurrency from args
function getConcurrency(args: string[]): number {
    const parallelArg = args.find(a => a.startsWith('--parallel'));
    if (!parallelArg) return 1; // Sequential by default

    const value = parallelArg.split('=')[1];
    if (value === 'auto') return os.cpus().length;
    return parseInt(value) || 1;
}

// Helper: Parse retries from args
function getRetries(args: string[]): number {
    const retriesArg = args.find(a => a.startsWith('--retries'));
    if (!retriesArg) return 0; // No retries by default

    const value = retriesArg.split('=')[1];
    return parseInt(value) || 0;
}

// Helper: Split array into chunks
function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// Execute a single test (potentially with multiple data rows)
async function runSingleTest(
    config: TestConfig,
    browser: Browser,
    reporter: Reporter,
    testNumber: number,
    totalTests: number,
    maxRetries: number
): Promise<void> {
    const prefix = `[${testNumber}/${totalTests}]`;
    console.log(chalk.cyan(`${prefix} Running: ${config.name}`));

    let dataRows: Record<string, string>[] = [config.parameters];

    // Load external data if specified
    if (config.data) {
        try {
            console.log(chalk.gray(`${prefix}   📂 Loading data from: ${config.data}`));
            const loadedData = await DataLoader.loadData(config.data);
            // Merge loaded data with default parameters (data overrides defaults)
            dataRows = loadedData.map(row => ({ ...config.parameters, ...row }));
            console.log(chalk.gray(`${prefix}   📊 Found ${dataRows.length} data rows`));
        } catch (error: any) {
            console.log(chalk.red(`${prefix} ❌ Failed to load data: ${error.message}`));
            reporter.addResult({
                id: config.id,
                name: config.name,
                configFile: `${config.id}.json`,
                templateId: config.templateId || 'unknown',
                status: 'FAIL',
                duration: 0,
                error: `Failed to load data: ${error.message}`,
                timestamp: new Date().toISOString()
            } as any);
            return;
        }
    }

    // Determine context options (device/viewport)
    let contextOptions = {};
    if (config.device) {
        const deviceConfig = devices[config.device];
        if (!deviceConfig) {
            console.log(chalk.yellow(`${prefix}   ⚠️  Device "${config.device}" not found. Using default.`));
        } else {
            console.log(chalk.gray(`${prefix}   📱 Emulating device: ${config.device}`));
            contextOptions = { ...deviceConfig };
        }
    }
    if (config.viewport) {
        console.log(chalk.gray(`${prefix}   📐 Setting viewport: ${config.viewport.width}x${config.viewport.height}`));
        contextOptions = { ...contextOptions, viewport: config.viewport };
    }

    // Iterate through each data row
    for (let i = 0; i < dataRows.length; i++) {
        const rowParams = dataRows[i];
        const rowSuffix = dataRows.length > 1 ? ` (Row ${i + 1})` : '';
        const testName = `${config.name}${rowSuffix}`;
        const testId = `${config.id}${dataRows.length > 1 ? `_row_${i + 1}` : ''}`;

        if (dataRows.length > 1) {
            console.log(chalk.cyan(`${prefix}   🔹 Executing Row ${i + 1}/${dataRows.length}`));
        }

        // Retry loop for this specific row
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const isRetry = attempt > 0;
            if (isRetry) {
                console.log(chalk.yellow(`${prefix} ⚠️  Retry attempt ${attempt}/${maxRetries}...`));
            }

            const context = await browser.newContext(contextOptions);
            const page = await context.newPage();
            const executor = new StepExecutor(page);
            const startTime = Date.now();

            try {
                const templatesToRun = config.workflow || [config.templateId!];

                for (const tmplId of templatesToRun) {
                    console.log(chalk.blue(`${prefix}     ➡️  Executing template: ${tmplId}`));
                    const template = await loadTemplate(tmplId);
                    if (!template) {
                        throw new Error(`Template ${tmplId} not found`);
                    }

                    for (const step of template.steps) {
                        await executor.execute(step, rowParams);
                    }
                }

                console.log(chalk.green(`${prefix}   ✅ PASS`));

                const perfData = (page as any)._perfResults;

                reporter.addResult({
                    id: testId,
                    name: testName,
                    configFile: `${config.id}.json`,
                    templateId: config.templateId || config.workflow?.join('+') || 'unknown',
                    status: 'PASS',
                    duration: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                    perfData
                });

                await context.close();
                break; // Success, move to next row

            } catch (error: any) {
                if (attempt < maxRetries) {
                    console.log(chalk.yellow(`${prefix}     ⚠️  Test failed: ${error.message}`));
                    await context.close();
                    continue; // Retry
                }

                console.log(chalk.red(`${prefix}   ❌ FAIL: ${error.message}`));

                const screenshotName = `fail-${testId}-${Date.now()}.png`;
                const screenshotPath = path.join(process.cwd(), 'screenshots', screenshotName);
                await page.screenshot({ path: screenshotPath });

                let visualDiff = (page as any)._visualDiff;
                let baselineImage = undefined;

                // Visual regression logic
                if (!visualDiff && rowParams.snapshotName) {
                    try {
                        const snapshotName = rowParams.snapshotName;
                        const baselinePath = path.join(process.cwd(), 'screenshots', 'baseline', `${snapshotName}.png`);

                        if (await import('fs-extra').then(fs => fs.default.pathExists(baselinePath))) {
                            const fs = (await import('fs-extra')).default;
                            const { PNG } = await import('pngjs');
                            const pixelmatch = (await import('pixelmatch')).default;

                            const baselineBuffer = await fs.readFile(baselinePath);
                            const actualBuffer = await fs.readFile(screenshotPath);

                            const img1 = PNG.sync.read(baselineBuffer);
                            const img2 = PNG.sync.read(actualBuffer);
                            const { width, height } = img1;

                            if (img2.width === width && img2.height === height) {
                                const diff = new PNG({ width, height });
                                const numDiffPixels = pixelmatch(
                                    img1.data, img2.data, diff.data, width, height, { threshold: 0.1 }
                                );

                                if (numDiffPixels > 0) {
                                    const diffPath = path.join(process.cwd(), 'screenshots', `diff-${snapshotName}-${Date.now()}.png`);
                                    fs.writeFileSync(diffPath, PNG.sync.write(diff));
                                    visualDiff = diffPath;
                                    baselineImage = baselinePath;
                                }
                            }
                        }
                    } catch (e) {
                        console.log(chalk.yellow(`${prefix}   ⚠️  Failed to generate visual diff on failure: ${(e as any).message}`));
                    }
                }

                reporter.addResult({
                    id: testId,
                    name: testName,
                    configFile: `${config.id}.json`,
                    templateId: config.templateId || config.workflow?.join('+') || 'unknown',
                    status: 'FAIL',
                    duration: Date.now() - startTime,
                    error: error.message,
                    screenshot: screenshotPath,
                    timestamp: new Date().toISOString(),
                    visualDiff: visualDiff,
                    baselineImage: baselineImage
                } as any);

                await context.close();
            }
        }
    }
}

async function runTests() {
    const args = process.argv.slice(2);
    const tagIndex = args.indexOf('--tags');
    const filterTag = tagIndex !== -1 ? args[tagIndex + 1] : null;
    const concurrency = getConcurrency(args);
    const maxRetries = getRetries(args);

    console.log(chalk.blue.bold('\n🚀 Starting UI Test Runner...\n'));

    const configs = await loadConfigs();
    const reporter = new Reporter();

    const testsToRun = filterTag
        ? configs.filter(c => c.tags?.includes(filterTag))
        : configs;

    if (testsToRun.length === 0) {
        console.log(chalk.yellow('No tests found to run.'));
        return;
    }

    const concurrencyMsg = concurrency === 1 ? 'sequential' : `concurrency: ${concurrency}`;
    const retriesMsg = maxRetries > 0 ? `, retries: ${maxRetries}` : '';
    console.log(`Found ${testsToRun.length} tests to execute (${concurrencyMsg}${retriesMsg}).\n`);

    const browser = await chromium.launch({ headless: true });

    if (concurrency === 1) {
        for (let i = 0; i < testsToRun.length; i++) {
            await runSingleTest(testsToRun[i], browser, reporter, i + 1, testsToRun.length, maxRetries);
        }
    } else {
        const batches = chunk(testsToRun, concurrency);
        let completedTests = 0;
        for (const batch of batches) {
            await Promise.all(
                batch.map((config, batchIndex) => {
                    const testNumber = completedTests + batchIndex + 1;
                    return runSingleTest(config, browser, reporter, testNumber, testsToRun.length, maxRetries);
                })
            );
            completedTests += batch.length;
        }
    }

    await browser.close();

    console.log(chalk.blue.bold('\nGenerating reports...'));
    const { htmlPath, jsonPath } = await reporter.generateReports();
    console.log(`📄 HTML Report: ${htmlPath}`);
    console.log(`📄 JSON Report: ${jsonPath}`);
}

runTests().catch(console.error);
