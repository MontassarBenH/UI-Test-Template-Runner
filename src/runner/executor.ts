import { Page, expect, APIResponse } from '@playwright/test';
import { TemplateStep } from '../types/template';
import fs from 'fs-extra';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

import { CustomAction } from '../types/plugin';
import { PluginLoader } from '../utils/plugin-loader';

export class StepExecutor {
    private lastResponse: APIResponse | undefined;
    private plugins: Map<string, CustomAction> = new Map();

    constructor(private page: Page) {
        this.loadPlugins();
    }

    private async loadPlugins() {
        const loader = new PluginLoader();
        this.plugins = await loader.loadPlugins();
    }

    async execute(step: TemplateStep, params: Record<string, any>) {
        const action = step.action;
        // Replace placeholders in params
        const resolvedParams = step.params.map(p => this.resolveParam(p, params));

        console.log(`  Running step: ${action} ${resolvedParams.join(', ')}`);

        try {
            switch (action) {
                case 'goto':
                    await this.page.goto(resolvedParams[0]);
                    break;

                case 'type':
                    if (!resolvedParams[0]) {
                        // Skip if selector is empty (optional field)
                        break;
                    }
                    await this.page.fill(resolvedParams[0], resolvedParams[1]);
                    break;

                case 'click':
                    if (!resolvedParams[0]) {
                        // Skip if selector is empty (optional navigation)
                        break;
                    }
                    await this.page.click(resolvedParams[0]);
                    break;

                case 'expect_text':
                    if (resolvedParams[1] === '') {
                        await expect(this.page.locator(resolvedParams[0])).toBeVisible();
                    } else {
                        await expect(this.page.locator(resolvedParams[0])).toContainText(resolvedParams[1]);
                    }
                    break;

                case 'expect_url':
                    await expect(this.page).toHaveURL(new RegExp(resolvedParams[0]));
                    break;

                case 'wait':
                    await this.page.waitForTimeout(parseInt(resolvedParams[0]));
                    break;

                case 'request':
                    const [method, url, body] = resolvedParams;
                    const options: any = { method };
                    if (body && body.trim() !== '') {
                        try {
                            options.data = JSON.parse(body);
                        } catch (e) {
                            options.data = body;
                        }
                    }
                    this.lastResponse = await this.page.request.fetch(url, options);
                    console.log(`    Response status: ${this.lastResponse.status()}`);
                    break;

                case 'expect_status':
                    if (!this.lastResponse) throw new Error('No API response to check. Run "request" first.');
                    const expectedStatus = parseInt(resolvedParams[0]);
                    if (this.lastResponse.status() !== expectedStatus) {
                        throw new Error(`Expected status ${expectedStatus} but got ${this.lastResponse.status()}`);
                    }
                    break;

                case 'expect_response_body':
                    if (!this.lastResponse) throw new Error('No API response to check. Run "request" first.');
                    const responseBody = await this.lastResponse.text();
                    if (!responseBody.includes(resolvedParams[0])) {
                        throw new Error(`Response body does not contain "${resolvedParams[0]}"`);
                    }
                    break;

                case 'measure_performance':
                    const [perfMethod, perfUrl, iterationsStr] = resolvedParams;
                    const iterations = parseInt(iterationsStr);
                    const latencies: number[] = [];

                    console.log(`    Starting performance test: ${iterations} iterations...`);

                    for (let i = 0; i < iterations; i++) {
                        const start = Date.now();
                        await this.page.request.fetch(perfUrl, { method: perfMethod });
                        const duration = Date.now() - start;
                        latencies.push(duration);
                        if (i % 10 === 0) process.stdout.write('.');
                    }
                    console.log('\n');

                    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
                    const max = Math.max(...latencies);
                    const min = Math.min(...latencies);

                    console.log(`    Results: Avg=${avg.toFixed(2)}ms, Min=${min}ms, Max=${max}ms`);

                    // Store results for reporter
                    (this.page as any)._perfResults = { latencies, avg, min, max };
                    break;

                case 'compare_screenshot':
                    const snapshotName = resolvedParams[0];
                    if (!snapshotName) {
                        console.log('    ℹ️  Skipping visual check (no snapshot name provided)');
                        break;
                    }

                    const screenshotBuffer = await this.page.screenshot();
                    const baselineDir = path.join(process.cwd(), 'screenshots', 'baseline');
                    const actualDir = path.join(process.cwd(), 'screenshots', 'actual');
                    const baselinePath = path.join(baselineDir, `${snapshotName}.png`);
                    const actualPath = path.join(actualDir, `${snapshotName}.png`);

                    await fs.ensureDir(baselineDir);
                    await fs.ensureDir(actualDir);

                    if (!await fs.pathExists(baselinePath)) {
                        console.log(`    ⚠️  Baseline not found. Saving new baseline: ${snapshotName}`);
                        await fs.writeFile(baselinePath, screenshotBuffer);
                    } else {
                        const baselineBuffer = await fs.readFile(baselinePath);
                        const img1 = PNG.sync.read(baselineBuffer);
                        const img2 = PNG.sync.read(screenshotBuffer);
                        const { width, height } = img1;
                        const diff = new PNG({ width, height });

                        const numDiffPixels = pixelmatch(
                            img1.data, img2.data, diff.data, width, height, { threshold: 0.1 }
                        );

                        if (numDiffPixels > 0) {
                            const diffPath = path.join(process.cwd(), 'screenshots', `diff-${snapshotName}-${Date.now()}.png`);
                            fs.writeFileSync(diffPath, PNG.sync.write(diff));

                            // Save actual screenshot for approval workflow
                            await fs.writeFile(actualPath, screenshotBuffer);

                            console.log(`    ❌ Visual regression detected! ${numDiffPixels} pixels different.`);
                            (this.page as any)._visualDiff = diffPath;
                            throw new Error(`Visual regression detected: ${numDiffPixels} pixels differ. Run 'npm run baseline:approve' to accept changes.`);
                        } else {
                            console.log('    ✅ Visual check passed.');
                            // Clean up actual if it exists (since it passed)
                            if (await fs.pathExists(actualPath)) {
                                await fs.remove(actualPath);
                            }
                        }
                    }
                    break;

                default:
                    // Check if it's a custom plugin
                    if (this.plugins.has(action)) {
                        const plugin = this.plugins.get(action)!;
                        await plugin.execute(this.page, resolvedParams);
                    } else {
                        throw new Error(`Unknown action: ${action}`);
                    }
            }
        } catch (error: any) {
            throw new Error(`Step failed: ${action} - ${error.message}`);
        }
    }

    private resolveParam(value: string, params: Record<string, any>): string {
        if (!value.startsWith('{{') || !value.endsWith('}}')) {
            return value;
        }

        const key = value.slice(2, -2);

        // Check for environment variable syntax: {{env.VARIABLE_NAME}}
        if (key.startsWith('env.')) {
            const envVar = key.slice(4); // Remove 'env.' prefix
            const envValue = process.env[envVar];
            if (envValue === undefined) {
                throw new Error(`Environment variable ${envVar} is not defined. Please set it in your .env file.`);
            }
            return envValue;
        }

        // Regular parameter resolution
        if (params[key] === undefined) {
            // Return empty string for missing parameters to support optional params
            return '';
        }
        return String(params[key]);
    }
}
