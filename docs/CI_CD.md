# CI/CD Integration Guide

This guide explains how to automate your UI tests using GitHub Actions.

## 🚀 Quick Setup

We have provided a ready-to-use workflow file in `.github/workflows/test.yml`. 
Once you push this code to GitHub, your tests will automatically run on every push and pull request.

## 🔑 Setting Up Secrets

To securely use credentials (like passwords) in your CI/CD pipeline:

1. Go to your GitHub Repository.
2. Click on **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret**.
4. Add your secrets (matching the names in your `.env` file):
   - Name: `TEST_USERNAME`, Value: `your-username`
   - Name: `TEST_PASSWORD`, Value: `your-password`
   - Name: `API_KEY`, Value: `your-api-key`

The workflow is already configured to inject these secrets as environment variables:

```yaml
env:
  TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
  TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
```

## 📊 Viewing Reports

After a test run completes:

1. Go to the **Actions** tab in your repository.
2. Click on the latest workflow run.
3. Scroll down to the **Artifacts** section.
4. Download the `test-report` zip file.
5. Extract it and open `index.html` to view the full test report with screenshots.

## ⏰ Scheduled Runs

The workflow is configured to run automatically every day at midnight UTC:

```yaml
schedule:
  - cron: '0 0 * * *'
```

You can modify this cron schedule in `.github/workflows/test.yml` to change the frequency.

## ⚡ Parallel Execution in CI

To speed up CI runs, you can update the test command in `.github/workflows/test.yml` to use parallel execution:

```yaml
- name: Run UI Tests
  run: npm run test:all -- --parallel=auto
```
