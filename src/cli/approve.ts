import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { PNG } from 'pngjs';

const ACTUAL_DIR = path.join(process.cwd(), 'screenshots', 'actual');
const BASELINE_DIR = path.join(process.cwd(), 'screenshots', 'baseline');

async function approveBaselines() {
    console.log(chalk.blue.bold('\n📸 Visual Regression Approval Workflow\n'));

    if (!await fs.pathExists(ACTUAL_DIR)) {
        console.log(chalk.green('No pending visual changes found.'));
        return;
    }

    const files = await fs.readdir(ACTUAL_DIR);
    const pngFiles = files.filter(f => f.endsWith('.png'));

    if (pngFiles.length === 0) {
        console.log(chalk.green('No pending visual changes found.'));
        return;
    }

    console.log(chalk.yellow(`Found ${pngFiles.length} pending changes.\n`));

    for (const file of pngFiles) {
        const actualPath = path.join(ACTUAL_DIR, file);
        const baselinePath = path.join(BASELINE_DIR, file);
        const snapshotName = path.basename(file, '.png');

        console.log(chalk.cyan(`\nReviewing: ${snapshotName}`));

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: `What do you want to do with ${snapshotName}?`,
                choices: [
                    { name: 'Approve (Overwrite Baseline)', value: 'approve' },
                    { name: 'Reject (Delete Actual)', value: 'reject' },
                    { name: 'Skip', value: 'skip' }
                ]
            }
        ]);

        if (action === 'approve') {
            await fs.move(actualPath, baselinePath, { overwrite: true });
            console.log(chalk.green(`  ✅ Approved! Baseline updated for ${snapshotName}`));
        } else if (action === 'reject') {
            await fs.remove(actualPath);
            console.log(chalk.red(`  ❌ Rejected. Actual screenshot deleted.`));
        } else {
            console.log(chalk.gray(`  ⏭️  Skipped.`));
        }
    }

    console.log(chalk.blue.bold('\nDone!'));
}

approveBaselines().catch(console.error);
