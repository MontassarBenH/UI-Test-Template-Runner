# 🚀 UI Test Template Runner

A powerful, lightweight, and template-based UI test automation framework designed for QA engineers and developers. Create, run, and manage automated browser tests without writing a single line of code.

## ✨ Features

-   **📝 Template Library**: Ready-to-use templates for Login, Search, Forms, API, and Performance testing.
-   **🔗 Workflows**: Combine multiple templates into complex user journeys (e.g., Login -> Submit Form).
-   **📸 Visual Regression**: Automatically detect visual changes with pixel-perfect precision.
-   **✅ Approval Workflow**: Interactive CLI to review and approve visual changes.
-   **🧙‍♂️ CLI Wizard**: Create test configurations easily with an interactive guide.
-   **📊 Rich Reporting**: Generate detailed HTML reports with screenshots, visual diffs, and performance charts.

---

## 🛠️ Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd ui-test-template-runner
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

---

## 🚦 Quick Start

### 1. Create a Test
Run the interactive wizard to create a new test configuration:
```bash
npm run config:create
```
Follow the prompts to select a template (e.g., `Basic Login`) and enter your target URL and selectors.

### 2. Run Tests
Execute all your saved tests:
```bash
npm run test:all
```
To run only specific tests (e.g., smoke tests), use tags:
```bash
npm run test:all -- --tags smoke
```

To run tests in parallel (faster!):
```bash
# Run 3 tests concurrently
npm run test:all -- --parallel=3

# Use all available CPU cores
npm run test:all -- --parallel=auto
```

To retry flaky tests automatically:
```bash
# Retry failed tests up to 2 times
npm run test:all -- --retries=2
```

### 3. Validate Configurations (Optional)
Check all your configs for errors before running tests:
```bash
npm run config:validate
```

This will catch:
- Missing required fields
- Invalid CSS selectors
- Duplicate snapshot names
- Missing environment variables

### 4. View Reports
Open the generated HTML report in the `reports/html/` directory to see results, screenshots, and visual diffs.

---

## 🔐 Environment Variables

**Keep your credentials secure!** Instead of hardcoding passwords in config files, use environment variables.

### Setup

1.  **Create a `.env` file** (copy from `.env.example`):
    ```bash
    cp .env.example .env
    ```

2.  **Add your credentials**:
    ```env
    TEST_USERNAME=your-username
    TEST_PASSWORD=your-password
    ```

3.  **Reference in configs** using `{{env.VARIABLE_NAME}}`:
    ```json
    {
      "parameters": {
        "username": "{{env.TEST_USERNAME}}",
        "password": "{{env.TEST_PASSWORD}}"
      }
    }
    ```

> [!IMPORTANT]
> The `.env` file is automatically ignored by git. **Never commit credentials to version control!**

---

## 🚀 CI/CD Integration

Automate your tests with GitHub Actions!

- **Automatic Runs**: Tests run on every push and PR.
- **Scheduled Testing**: Nightly regression tests.
- **Artifacts**: Download HTML reports from GitHub.

👉 **[Read the CI/CD Setup Guide](docs/CI_CD.md)**

---

## 🧩 Custom Plugins

Extend the runner with your own actions!

1. Create a `.ts` file in the `plugins/` directory.
2. Export an `action` object:
   ```typescript
   import { Page } from '@playwright/test';
   
   export const action = {
       name: 'my_action',
       execute: async (page: Page, params: any[]) => {
           console.log('Hello from plugin!');
       }
   };
   ```
3. Use it in your templates:
   ```json
   {
       "action": "my_action",
       "params": []
   }
   ```

---

## 📊 Data Driven Testing

Run the same test with multiple data sets using JSON or CSV files.

1. Create a data file (e.g., `data/users.json`):
   ```json
   [
       { "username": "user1", "password": "pw1" },
       { "username": "user2", "password": "pw2" }
   ]
   ```
2. Reference it in your config:
   ```json
   {
       "templateId": "login_basic",
       "data": "users.json",
       "parameters": {
           "url": "https://example.com"
       }
   }
   ```
3. The runner will execute the test once for each row in the data file!

---

## 📱 Mobile & Responsive Testing

Test your site on different devices or viewports.

### Device Emulation
Use any Playwright-supported device (e.g., "iPhone 12", "Pixel 5", "iPad Pro 11"):
```json
{
    "templateId": "login_basic",
    "device": "iPhone 12",
    "parameters": { ... }
}
```

### Custom Viewport
Or set a specific resolution:
```json
{
    "templateId": "login_basic",
    "viewport": { "width": 1280, "height": 720 },
    "parameters": { ... }
}
```

---

## 📚 Template Guide

### 🔐 Basic Login (`login_basic`)
Standard login flow with visual verification.
-   **Steps**: Navigate -> Enter Username/Password -> Click Submit -> Wait -> Verify Success Text -> Visual Check.
-   **Use for**: Authentication flows.

### 📝 Form Submission (`form_submit_basic`)
Flexible form filling.
-   **Features**: Supports up to 5 fields, optional navigation step (e.g., clicking "Open Form"), and smart skipping of empty fields.
-   **Use for**: Contact forms, claim submissions, sign-ups.

### 🔍 Basic Search (`search_basic`)
Search functionality verification.
-   **Steps**: Navigate -> Enter Search Term -> Click Search -> Verify Results.
-   **Use for**: Search bars, filtering.

### 🌐 API Request (`api_basic`)
REST API validation.
-   **Steps**: Send Request (GET/POST/etc.) -> Verify Status Code -> Verify Response Body.
-   **Use for**: Backend health checks, data verification.

### ⚡ Performance Test (`performance_basic`)
Measure API response times.
-   **Features**: Runs multiple iterations, calculates Avg/Min/Max latency, and generates charts.
-   **Use for**: Load testing, latency monitoring.

---

## 🔗 Workflows (Advanced)

Combine multiple templates to create end-to-end scenarios.
**Example**: Login first, then submit a claim.

Edit your config file (`configs/my_test.json`) and use the `workflow` property:
```json
{
  "id": "claim_workflow",
  "workflow": ["login_basic", "form_submit_basic"],
  "parameters": {
    "url": "https://example.com/login",
    "username": "...",
    "navigateSelector": "#open-claim-form",
    "field1Value": "..."
  }
}
```

---

## 📸 Visual Regression & Approval

The runner automatically captures screenshots. If a test fails or a visual mismatch is detected:
1.  **Failure**: The test fails, and a diff image is generated.
2.  **Report**: The HTML report shows **Baseline vs. Actual vs. Diff** side-by-side.
3.  **Approve**: To accept the new look as the new baseline, run:
    ```bash
    npm run baseline:approve
    ```
    Select the snapshot you want to update.

---

## 📂 Project Structure

-   `src/templates/`: JSON definitions of test steps.
-   `configs/`: Your saved test configurations.
-   `reports/`: HTML and JSON execution reports.
-   `screenshots/`:
    -   `baseline/`: Approved reference images.
    -   `actual/`: Failed test screenshots.
    -   `diff/`: Visual difference highlights.

---

## 💻 Tech Stack

-   **Runtime**: Node.js & TypeScript
-   **Automation**: Playwright
-   **Visual Diff**: Pixelmatch & PNGjs
-   **CLI**: Inquirer

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

