import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfigs, deleteConfig } from '../utils/file-handler';

const program = new Command();

program
    .command('list')
    .description('List all saved test configurations')
    .action(async () => {
        const configs = await loadConfigs();
        if (configs.length === 0) {
            console.log(chalk.yellow('No configurations found. Create one with "npm run config:create"'));
            return;
        }

        console.log(chalk.blue.bold('\nSaved Test Configurations:'));
        console.table(configs.map(c => ({
            ID: c.id,
            Name: c.name,
            Template: c.templateId,
            Tags: c.tags?.join(', ') || ''
        })));
    });

program
    .command('delete')
    .description('Delete a test configuration')
    .action(async () => {
        const configs = await loadConfigs();
        if (configs.length === 0) {
            console.log(chalk.yellow('No configurations found to delete.'));
            return;
        }

        const { configId } = await inquirer.prompt([
            {
                type: 'list',
                name: 'configId',
                message: 'Select a configuration to delete:',
                choices: configs.map(c => ({
                    name: `${c.name} (${c.id})`,
                    value: c.id
                }))
            }
        ]);

        await deleteConfig(configId);
        console.log(chalk.green(`\n✅ Configuration ${configId} deleted successfully.`));
    });

program.parse(process.argv);
