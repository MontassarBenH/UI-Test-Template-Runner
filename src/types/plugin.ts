import { Page } from '@playwright/test';

export interface CustomAction {
    name: string;
    execute: (page: Page, params: any[]) => Promise<void>;
}
