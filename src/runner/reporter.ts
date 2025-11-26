import fs from 'fs-extra';
import path from 'path';

export interface TestResult {
  id: string;
  name: string;
  configFile: string;
  templateId: string;
  status: 'PASS' | 'FAIL';
  duration: number;
  error?: string;
  screenshot?: string;
  timestamp: string;
  perfData?: {
    latencies: number[];
    avg: number;
    min: number;
    max: number;
  };
  visualDiff?: string;
  baselineImage?: string;
}

export class Reporter {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  addResult(result: TestResult) {
    this.results.push(result);
  }

  async generateReports() {
    const reportDir = path.join(process.cwd(), 'reports');
    await fs.ensureDir(path.join(reportDir, 'json'));
    await fs.ensureDir(path.join(reportDir, 'html'));

    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      failed: this.results.filter(r => r.status === 'FAIL').length,
      duration: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
      results: this.results
    };

    // Generate JSON Report
    const jsonPath = path.join(reportDir, 'json', `report-${Date.now()}.json`);
    await fs.writeJson(jsonPath, summary, { spaces: 2 });

    // Generate HTML Report
    const htmlPath = path.join(reportDir, 'html', `report-${Date.now()}.html`);
    const htmlContent = this.generateHtml(summary);
    await fs.writeFile(htmlPath, htmlContent);

    return { jsonPath, htmlPath };
  }

  private generateHtml(summary: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>UI Test Execution Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    .summary { display: flex; gap: 20px; margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-radius: 6px; }
    .stat { text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { color: #666; font-size: 14px; }
    .pass { color: #28a745; }
    .fail { color: #dc3545; }
    .test-card { border: 1px solid #eee; margin-bottom: 15px; border-radius: 6px; overflow: hidden; }
    .test-header { padding: 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; background: #fff; }
    .test-header:hover { background: #f8f9fa; }
    .test-status { font-weight: bold; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .status-PASS { background: #d4edda; color: #155724; }
    .status-FAIL { background: #f8d7da; color: #721c24; }
    .test-details { padding: 15px; border-top: 1px solid #eee; background: #fafafa; }
    .error-msg { color: #dc3545; font-family: monospace; background: #fff; padding: 10px; border: 1px solid #f8d7da; border-radius: 4px; }
    .screenshot { margin-top: 10px; max-width: 100%; border: 1px solid #ddd; border-radius: 4px; }
    .chart-container { margin-top: 20px; height: 300px; }
    .visual-comparison { display: flex; gap: 10px; margin-top: 15px; overflow-x: auto; }
    .visual-comparison > div { flex: 1; min-width: 200px; }
    .visual-comparison img { width: 100%; border: 1px solid #ddd; border-radius: 4px; }
    .visual-label { font-size: 12px; font-weight: bold; color: #666; margin-bottom: 5px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>UI Test Execution Report</h1>
    
    <div class="summary">
      <div class="stat">
        <div class="stat-value">${summary.total}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat">
        <div class="stat-value pass">${summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat">
        <div class="stat-value fail">${summary.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat">
        <div class="stat-value">${(summary.duration / 1000).toFixed(2)}s</div>
        <div class="stat-label">Duration</div>
      </div>
    </div>

    <div class="results">
      ${summary.results.map((r: any, index: number) => `
        <div class="test-card">
          <div class="test-header" onclick="document.getElementById('details-${index}').style.display = document.getElementById('details-${index}').style.display === 'none' ? 'block' : 'none'">
            <div>
              <strong>${r.name}</strong>
              <div style="font-size: 12px; color: #666; margin-top: 4px;">${r.templateId}</div>
            </div>
            <span class="test-status status-${r.status}">${r.status}</span>
          </div>
          <div id="details-${index}" class="test-details" style="display: ${r.status === 'FAIL' || r.perfData ? 'block' : 'none'}">
            ${r.status === 'FAIL' ? `
              <div class="error-msg">${r.error}</div>
              
              ${r.visualDiff ? `
                <div style="margin-top: 15px;">
                  <strong>Visual Regression Analysis:</strong>
                  <div class="visual-comparison">
                    ${r.baselineImage ? `
                      <div>
                        <div class="visual-label">Baseline</div>
                        <img src="${path.relative(path.join(process.cwd(), 'reports', 'html'), r.baselineImage)}" />
                      </div>
                    ` : ''}
                    <div>
                      <div class="visual-label">Actual (Failure)</div>
                      <img src="${path.relative(path.join(process.cwd(), 'reports', 'html'), r.screenshot)}" />
                    </div>
                    <div>
                      <div class="visual-label">Diff</div>
                      <img src="${path.relative(path.join(process.cwd(), 'reports', 'html'), r.visualDiff)}" style="border-color: red;" />
                    </div>
                  </div>
                </div>
              ` : `
                ${r.screenshot ? `
                  <div><strong>Screenshot:</strong></div>
                  <img src="${path.relative(path.join(process.cwd(), 'reports', 'html'), r.screenshot)}" class="screenshot" />
                ` : ''}
              `}
            ` : ''}
            
            ${r.perfData ? `
              <h3>Performance Results</h3>
              <p>
                <strong>Avg:</strong> 
                <span style="color: ${r.perfData.avg < 300 ? '#28a745' : r.perfData.avg < 800 ? '#ffc107' : '#dc3545'}; font-weight: bold;">
                  ${r.perfData.avg.toFixed(2)}ms
                </span> 
                | <strong>Min:</strong> ${r.perfData.min}ms 
                | <strong>Max:</strong> ${r.perfData.max}ms
              </p>
              <div class="chart-container">
                <canvas id="chart-${index}"></canvas>
              </div>
              <script>
                new Chart(document.getElementById('chart-${index}'), {
                  type: 'line',
                  data: {
                    labels: ${JSON.stringify(r.perfData.latencies.map((_: any, i: number) => i + 1))},
                    datasets: [{
                      label: 'Response Time (ms)',
                      data: ${JSON.stringify(r.perfData.latencies)},
                      borderColor: 'rgb(75, 192, 192)',
                      tension: 0.1
                    }]
                  },
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: 'Time (ms)' } },
                      x: { title: { display: true, text: 'Iteration' } }
                    }
                  }
                });
              </script>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
    `;
  }
}
