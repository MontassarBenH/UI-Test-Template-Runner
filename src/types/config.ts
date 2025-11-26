export interface TestConfig {
    id: string;
    name: string;
    templateId?: string;
    workflow?: string[]; // List of template IDs to run in sequence
    parameters: Record<string, string>;
    data?: string; // Path to JSON or CSV data file
    device?: string; // e.g., "iPhone 12"
    viewport?: { width: number; height: number };
    tags?: string[];
    createdAt: string;
}
