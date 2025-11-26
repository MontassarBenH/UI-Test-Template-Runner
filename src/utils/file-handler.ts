import fs from 'fs-extra';
import path from 'path';
import { Template } from '../types/template';
import { TestConfig } from '../types/config';

const TEMPLATES_DIR = path.join(process.cwd(), 'src', 'templates');
const CONFIGS_DIR = path.join(process.cwd(), 'configs');

export async function loadTemplates(): Promise<Template[]> {
    const files = await fs.readdir(TEMPLATES_DIR);
    const templates: Template[] = [];

    for (const file of files) {
        if (file.endsWith('.json')) {
            const content = await fs.readJson(path.join(TEMPLATES_DIR, file));
            templates.push(content);
        }
    }

    return templates;
}

export async function loadTemplate(templateId: string): Promise<Template | null> {
    const templates = await loadTemplates();
    return templates.find(t => t.id === templateId) || null;
}

export async function saveConfig(config: TestConfig): Promise<string> {
    await fs.ensureDir(CONFIGS_DIR);
    const filename = `${config.id}.json`;
    const filepath = path.join(CONFIGS_DIR, filename);
    await fs.writeJson(filepath, config, { spaces: 2 });
    return filepath;
}

export async function loadConfigs(): Promise<TestConfig[]> {
    await fs.ensureDir(CONFIGS_DIR);
    const files = await fs.readdir(CONFIGS_DIR);
    const configs: TestConfig[] = [];

    for (const file of files) {
        if (file.endsWith('.json')) {
            const content = await fs.readJson(path.join(CONFIGS_DIR, file));
            configs.push(content);
        }
    }

    return configs;
}

export async function deleteConfig(configId: string): Promise<void> {
    const filepath = path.join(CONFIGS_DIR, `${configId}.json`);
    if (await fs.pathExists(filepath)) {
        await fs.remove(filepath);
    }
}
