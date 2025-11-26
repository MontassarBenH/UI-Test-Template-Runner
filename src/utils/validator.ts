import { TestConfig } from '../types/config';
import { loadTemplate } from './file-handler';
import chalk from 'chalk';

export interface ValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

export class ConfigValidator {
    /**
     * Validate a test configuration
     */
    async validate(config: TestConfig): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        // 1. Required fields validation
        this.validateRequiredFields(config, errors);

        // 2. Template/Workflow validation
        await this.validateTemplateOrWorkflow(config, errors, warnings);

        // 3. Selector syntax validation
        this.validateSelectors(config, warnings);

        // 4. Environment variable validation
        this.validateEnvironmentVariables(config, warnings);

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate multiple configs and check for duplicates
     */
    async validateMultiple(configs: TestConfig[]): Promise<Map<string, ValidationResult>> {
        const results = new Map<string, ValidationResult>();

        // Validate each config individually
        for (const config of configs) {
            const result = await this.validate(config);
            results.set(config.id, result);
        }

        // Check for duplicate snapshot names
        this.checkDuplicateSnapshots(configs, results);

        return results;
    }

    private validateRequiredFields(config: TestConfig, errors: ValidationError[]): void {
        if (!config.id) {
            errors.push({ field: 'id', message: 'Config ID is required', severity: 'error' });
        }

        if (!config.name) {
            errors.push({ field: 'name', message: 'Config name is required', severity: 'error' });
        }

        if (!config.templateId && !config.workflow) {
            errors.push({
                field: 'templateId/workflow',
                message: 'Either templateId or workflow must be specified',
                severity: 'error'
            });
        }

        if (!config.parameters) {
            errors.push({ field: 'parameters', message: 'Parameters object is required', severity: 'error' });
        }
    }

    private async validateTemplateOrWorkflow(
        config: TestConfig,
        errors: ValidationError[],
        warnings: ValidationError[]
    ): Promise<void> {
        const templateIds = config.workflow || (config.templateId ? [config.templateId] : []);

        for (const tmplId of templateIds) {
            const template = await loadTemplate(tmplId);

            if (!template) {
                errors.push({
                    field: 'templateId',
                    message: `Template "${tmplId}" not found`,
                    severity: 'error'
                });
                continue;
            }

            // Check required parameters
            if (template.requiredParameters) {
                for (const param of template.requiredParameters) {
                    const paramValue = config.parameters[param.name];

                    // Skip validation for optional parameters (those with "Optional:" in description)
                    if (param.description?.toLowerCase().includes('optional')) {
                        continue;
                    }

                    if (paramValue === undefined || paramValue === '') {
                        warnings.push({
                            field: param.name,
                            message: `Required parameter "${param.name}" is missing for template "${tmplId}"`,
                            severity: 'warning'
                        });
                    }
                }
            }
        }
    }

    private validateSelectors(config: TestConfig, warnings: ValidationError[]): void {
        if (!config.parameters) return;

        const selectorParams = Object.keys(config.parameters).filter(key =>
            key.toLowerCase().includes('selector')
        );

        for (const key of selectorParams) {
            const selector = config.parameters[key];

            if (typeof selector !== 'string' || !selector) continue;

            // Skip env vars
            if (selector.startsWith('{{env.')) continue;

            // Check for common selector mistakes
            if (!this.isValidSelector(selector)) {
                warnings.push({
                    field: key,
                    message: `Selector "${selector}" may be invalid. CSS selectors should start with #, ., [ or be a tag name.`,
                    severity: 'warning'
                });
            }
        }
    }

    private isValidSelector(selector: string): boolean {
        // Basic CSS selector validation
        const validPatterns = [
            /^#[\w-]+/,           // ID selector: #id
            /^\.[\w-]+/,          // Class selector: .class
            /^\[[\w-]+/,          // Attribute selector: [attr]
            /^[\w-]+$/,           // Tag selector: div
            /^[\w-]+\[/,          // Tag with attribute: button[type]
        ];

        return validPatterns.some(pattern => pattern.test(selector));
    }

    private validateEnvironmentVariables(config: TestConfig, warnings: ValidationError[]): void {
        if (!config.parameters) return;

        for (const [key, value] of Object.entries(config.parameters)) {
            if (typeof value === 'string' && value.startsWith('{{env.')) {
                const envVar = value.slice(6, -2); // Extract variable name

                if (!process.env[envVar]) {
                    warnings.push({
                        field: key,
                        message: `Environment variable "${envVar}" is not set. Make sure it's defined in your .env file.`,
                        severity: 'warning'
                    });
                }
            }
        }
    }

    private checkDuplicateSnapshots(configs: TestConfig[], results: Map<string, ValidationResult>): void {
        const snapshotMap = new Map<string, string[]>();

        for (const config of configs) {
            const snapshotName = config.parameters?.snapshotName;
            if (snapshotName && typeof snapshotName === 'string') {
                if (!snapshotMap.has(snapshotName)) {
                    snapshotMap.set(snapshotName, []);
                }
                snapshotMap.get(snapshotName)!.push(config.id);
            }
        }

        // Add warnings for duplicates
        for (const [snapshotName, configIds] of snapshotMap.entries()) {
            if (configIds.length > 1) {
                for (const configId of configIds) {
                    const result = results.get(configId);
                    if (result) {
                        result.warnings.push({
                            field: 'snapshotName',
                            message: `Snapshot name "${snapshotName}" is used by multiple configs: ${configIds.join(', ')}. This may cause baseline conflicts.`,
                            severity: 'warning'
                        });
                    }
                }
            }
        }
    }

    /**
     * Format validation results for display
     */
    formatResults(configId: string, result: ValidationResult): string {
        const lines: string[] = [];

        if (result.valid && result.warnings.length === 0) {
            lines.push(chalk.green(`✅ ${configId}: Valid`));
        } else {
            lines.push(chalk.yellow(`⚠️  ${configId}:`));

            for (const error of result.errors) {
                lines.push(chalk.red(`  ❌ [${error.field}] ${error.message}`));
            }

            for (const warning of result.warnings) {
                lines.push(chalk.yellow(`  ⚠️  [${warning.field}] ${warning.message}`));
            }
        }

        return lines.join('\n');
    }
}
