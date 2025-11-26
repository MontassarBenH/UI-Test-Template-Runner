import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { pathToFileURL } from 'url';
import { CustomAction } from '../types/plugin';

export class PluginLoader {
    private pluginsDir: string;

    constructor() {
        this.pluginsDir = path.join(process.cwd(), 'plugins');
    }

    async loadPlugins(): Promise<Map<string, CustomAction>> {
        const plugins = new Map<string, CustomAction>();

        if (!fs.existsSync(this.pluginsDir)) {
            // Create plugins directory if it doesn't exist
            fs.mkdirSync(this.pluginsDir, { recursive: true });
            return plugins;
        }

        const files = fs.readdirSync(this.pluginsDir).filter(file =>
            (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')
        );

        for (const file of files) {
            try {
                const filePath = path.join(this.pluginsDir, file);
                // Convert path to file:// URL for Windows support
                const fileUrl = pathToFileURL(filePath).href;

                // Dynamic import
                const module = await import(fileUrl);

                if (module.action && module.action.name && typeof module.action.execute === 'function') {
                    const action = module.action as CustomAction;
                    plugins.set(action.name, action);
                    console.log(chalk.gray(`  🔌 Loaded plugin: ${action.name}`));
                } else {
                    console.warn(chalk.yellow(`  ⚠️  Skipping invalid plugin file: ${file}`));
                }
            } catch (error: any) {
                console.error(chalk.red(`  ❌ Failed to load plugin ${file}: ${error.message}`));
            }
        }

        return plugins;
    }
}
