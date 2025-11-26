import chalk from 'chalk';
import { loadConfigs } from '../utils/file-handler';
import { ConfigValidator } from '../utils/validator';

async function validateConfigs() {
    console.log(chalk.blue.bold('\n🔍 Validating Test Configurations...\n'));

    try {
        const configs = await loadConfigs();

        if (configs.length === 0) {
            console.log(chalk.yellow('No configurations found to validate.'));
            return;
        }

        const validator = new ConfigValidator();
        const results = await validator.validateMultiple(configs);

        let hasErrors = false;
        let hasWarnings = false;

        // Display results
        for (const [configId, result] of results.entries()) {
            console.log(validator.formatResults(configId, result));

            if (!result.valid) hasErrors = true;
            if (result.warnings.length > 0) hasWarnings = true;
        }

        // Summary
        console.log(chalk.blue.bold('\n📊 Validation Summary:'));
        const validCount = Array.from(results.values()).filter(r => r.valid).length;
        const invalidCount = results.size - validCount;

        console.log(`  Total configs: ${results.size}`);
        console.log(chalk.green(`  Valid: ${validCount}`));

        if (invalidCount > 0) {
            console.log(chalk.red(`  Invalid: ${invalidCount}`));
        }

        if (hasWarnings) {
            console.log(chalk.yellow('\n⚠️  Some configs have warnings. Review them to ensure tests run correctly.'));
        }

        if (hasErrors) {
            console.log(chalk.red('\n❌ Some configs have errors. Fix them before running tests.'));
            process.exit(1);
        } else {
            console.log(chalk.green('\n✅ All configurations are valid!'));
        }

    } catch (error: any) {
        console.error(chalk.red(`\n❌ Validation failed: ${error.message}`));
        process.exit(1);
    }
}

validateConfigs().catch(console.error);
