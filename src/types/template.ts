export interface TemplateParameter {
    name: string;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'array';
    example?: string;
}

export interface TemplateStep {
    action: 'goto' | 'type' | 'click' | 'expect_text' | 'expect_url' | 'wait' | 'request' | 'expect_status' | 'expect_response_body' | 'measure_performance' | 'compare_screenshot';
    params: string[];
}

export interface Template {
    id: string;
    name: string;
    description: string;
    requiredParameters: TemplateParameter[];
    steps: TemplateStep[];
}
