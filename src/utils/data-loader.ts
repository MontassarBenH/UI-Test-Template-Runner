import fs from 'fs-extra';
import path from 'path';
import { parse } from 'csv-parse/sync';

export class DataLoader {
    static async loadData(filePath: string): Promise<Record<string, string>[]> {
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(process.cwd(), 'data', filePath);

        if (!await fs.pathExists(absolutePath)) {
            throw new Error(`Data file not found: ${absolutePath}`);
        }

        const ext = path.extname(absolutePath).toLowerCase();
        const content = await fs.readFile(absolutePath, 'utf-8');

        if (ext === '.json') {
            return JSON.parse(content);
        } else if (ext === '.csv') {
            return parse(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            });
        } else {
            throw new Error(`Unsupported data file format: ${ext}. Use .json or .csv`);
        }
    }
}
