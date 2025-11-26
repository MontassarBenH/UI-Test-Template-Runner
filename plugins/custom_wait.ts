import { Page } from '@playwright/test';
import { CustomAction } from '../src/types/plugin';

export const action: CustomAction = {
    name: 'custom_wait',
    execute: async (page: Page, params: any[]) => {
        const ms = parseInt(params[0]);
        console.log(`    🕒 Custom Wait Plugin: Waiting for ${ms}ms...`);
        await page.waitForTimeout(ms);
    }
};
