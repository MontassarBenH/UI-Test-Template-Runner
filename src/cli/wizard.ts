import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadTemplates, saveConfig } from '../utils/file-handler';
import { TestConfig } from '../types/config';

async function runWizard() {
    console.log(chalk.blue.bold('\n🚀 UI Test Configuration Wizard\n'));

    // 1. Load available templates
    const templates = await loadTemplates();

    if (templates.length === 0) {
        console.log(chalk.red('No templates found!'));
        return;
    }

    // 2. Select a template
    const { templateId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'templateId',
            message: 'Select a test template:',
            choices: templates.map(t => ({
                name: `${chalk.bold(t.name)} - ${t.description}`,
                value: t.id
            }))
        }
    ]);

    const selectedTemplate = templates.find(t => t.id === templateId)!;
    console.log(chalk.cyan(`\nSelected: ${selectedTemplate.name}`));
    console.log(chalk.gray('Please provide the following parameters:\n'));

    // 3. Collect parameters
    const parameters: Record<string, any> = {};

    for (const param of selectedTemplate.requiredParameters) {
        const answer = await inquirer.prompt([
            {
                type: 'input',
                name: 'value',
                message: `${param.name} (${param.description}):`,
                default: param.example,
                validate: (input) => input.length > 0 ? true : 'This field is required'
            }
        ]);
        parameters[param.name] = answer.value;
    }

    // 4. Config metadata
    const { configName, tags } = await inquirer.prompt([
        {
            type: 'input',
            name: 'configName',
            message: 'Name this test configuration:',
            default: `Test ${selectedTemplate.name} ${new Date().toISOString().split('T')[0]}`,
            validate: (input) => input.length > 0 ? true : 'Name is required'
        },
        {
            type: 'input',
            name: 'tags',
            message: 'Tags (comma separated, e.g. smoke, regression):',
        }
    ]);

    // 5. Create config object
    const config: TestConfig = {
        id: `config_${Date.now()}`,
        name: configName,
        templateId: selectedTemplate.id,
        parameters,
        tags: tags ? tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [],
        createdAt: new Date().toISOString()
    };

    // 6. Validate config before saving
    const { ConfigValidator } = await import('../utils/validator');
    const validator = new ConfigValidator();
    const validationResult = await validator.validate(config);

    if (!validationResult.valid) {
        console.log(chalk.red.bold('\n❌ Configuration validation failed:'));
        for (const error of validationResult.errors) {
            console.log(chalk.red(`  • [${error.field}] ${error.message}`));
        }
        console.log(chalk.yellow('\nPlease fix these errors and try again.'));
        return;
    }

    if (validationResult.warnings.length > 0) {
        console.log(chalk.yellow.bold('\n⚠️  Configuration has warnings:'));
        for (const warning of validationResult.warnings) {
            console.log(chalk.yellow(`  • [${warning.field}] ${warning.message}`));
        }

        const { proceed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: 'Do you want to save this configuration anyway?',
            default: true
        }]);

        if (!proceed) {
            console.log(chalk.gray('\nConfiguration not saved.'));
            return;
        }
    }

    // 7. Save config
    const filepath = await saveConfig(config);

    console.log(chalk.green.bold('\n✅ Configuration saved successfully!'));
    console.log(chalk.gray(`File: ${filepath}`));
    console.log(chalk.yellow('\nRun this test with:'));
    console.log(`npm run test:all`);
}

runWizard().catch(console.error);
