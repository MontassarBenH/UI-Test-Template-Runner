import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadConfigs, loadTemplates, saveConfig } from '../utils/file-handler';
import { TestConfig } from '../types/config';

async function runEditWizard() {
    console.log(chalk.blue.bold('\n✏️  UI Test Configuration Editor\n'));

    // 1. Load existing configs
    const configs = await loadConfigs();

    if (configs.length === 0) {
        console.log(chalk.red('No configurations found to edit!'));
        return;
    }

    // 2. Select a config to edit
    const { configId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'configId',
            message: 'Select a test to edit:',
            choices: configs.map(c => ({
                name: `${chalk.bold(c.name)} (${c.templateId})`,
                value: c.id
            }))
        }
    ]);

    const configToEdit = configs.find(c => c.id === configId)!;
    const templates = await loadTemplates();
    const template = templates.find(t => t.id === configToEdit.templateId);

    if (!template) {
        console.log(chalk.red(`Template ${configToEdit.templateId} not found!`));
        return;
    }

    console.log(chalk.cyan(`\nEditing: ${configToEdit.name}`));
    console.log(chalk.gray('Press Enter to keep current value, or type a new one.\n'));

    // 3. Edit parameters
    const newParameters: Record<string, any> = { ...configToEdit.parameters };

    for (const param of template.requiredParameters) {
        const currentValue = configToEdit.parameters[param.name];
        const answer = await inquirer.prompt([
            {
                type: 'input',
                name: 'value',
                message: `${param.name} (${param.description}):`,
                default: currentValue,
                validate: (input) => input.length > 0 ? true : 'This field is required' // You might want to allow empty for some, but sticking to basic validation
            }
        ]);
        newParameters[param.name] = answer.value;
    }

    // 4. Edit metadata (optional)
    const { configName, tags } = await inquirer.prompt([
        {
            type: 'input',
            name: 'configName',
            message: 'Test Name:',
            default: configToEdit.name,
            validate: (input) => input.length > 0 ? true : 'Name is required'
        },
        {
            type: 'input',
            name: 'tags',
            message: 'Tags (comma separated):',
            default: configToEdit.tags?.join(', ') || ''
        }
    ]);

    // 5. Save updates
    const updatedConfig: TestConfig = {
        ...configToEdit,
        name: configName,
        parameters: newParameters,
        tags: tags ? tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [],
        // Keep original ID and createdAt
    };

    const filepath = await saveConfig(updatedConfig);

    console.log(chalk.green.bold('\n✅ Configuration updated successfully!'));
    console.log(chalk.gray(`File: ${filepath}`));
}

runEditWizard().catch(console.error);
