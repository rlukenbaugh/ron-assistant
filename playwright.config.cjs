const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests/ui', workers: 1, timeout: 60000, reporter: 'list', use: { trace: 'retain-on-failure' } });
