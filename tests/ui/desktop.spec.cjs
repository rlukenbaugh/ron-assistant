const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const apps = [];
test.afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close().catch(() => {}))); });
async function launch(dir, packaged = false) {
  const environment = { ...process.env, RON_ASSISTANT_DATA_DIR: dir, ...(packaged ? {} : { RON_ASSISTANT_TEST: '1' }) };
  delete environment.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ ...(packaged ? { executablePath: path.join(root, 'release', 'win-unpacked', 'Ron Assistant.exe'), args: [] } : { args: [root] }), env: environment });
  apps.push(app); return app;
}
test('reading, reviews, safe links, clipboard, memory restart, failure and cancellation', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ron-assistant-ui-'));
  let app = await launch(dir); let page = await app.firstWindow();
  await expect(page.getByRole('button', { name: 'Ask assistants', exact: false })).toBeEnabled();
  await page.locator('#question').fill('Explain 17 times 19.');
  await page.locator('#ask').click();
  await expect(page.locator('#final-answer')).toContainText('323');
  await expect(page.locator('#results img, #results script')).toHaveCount(0);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  await page.locator('.final-card [data-format="plain"]').click();
  const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(copied).toContain('323'); expect(copied).not.toContain('**');
  await page.locator('.final-card [data-format="markdown"]').click();
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toContain('**323**');
  expect(await page.evaluate(() => window.ron.openLink('https://example.com/guide'))).toEqual({ opened: true, url: 'https://example.com/guide' });
  await expect(page.evaluate(() => window.ron.openLink('javascript:alert(1)'))).rejects.toThrow();
  await page.getByRole('button', { name: 'Memory & settings' }).click();
  await page.locator('#instructions').fill('Remember: call me Ron.');
  await page.locator('#font-size').fill('22');
  await page.locator('#retain-history').check();
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.locator('#save-status')).toContainText('Saved');
  await app.close();
  app = await launch(dir); page = await app.firstWindow();
  await expect(page.locator('#ask')).toBeEnabled();
  await page.getByRole('button', { name: 'Memory & settings' }).click();
  await expect(page.locator('#instructions')).toHaveValue('Remember: call me Ron.');
  await expect(page.locator('#font-size')).toHaveValue('22');
  await page.locator('.nav-item[data-view="conversation"]').click();
  await page.locator('#question').fill('[fail-codex] Explain 17 times 19.');
  await page.locator('#ask').click();
  await expect(page.locator('#results')).toContainText('no peer review was possible');
  await expect(page.getByRole('button', { name: 'Retry Codex' })).toBeEnabled();
  await page.locator('#question').fill('[slow] Explain 17 times 19.');
  await page.locator('#ask').click();
  await page.locator('#stop').click();
  await expect(page.locator('#status-line')).toContainText('Stopped');
  await page.getByRole('button', { name: 'Memory & settings' }).click();
  await page.locator('#theme').selectOption('light');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.locator('body')).toHaveClass('light');
  await page.locator('.nav-item[data-view="conversation"]').click();
  await page.screenshot({ path: path.join(root, 'work', 'ui-test-light.png'), fullPage: true });
  await app.close();
});
test('wake input submits once, keeps typed drafts and is off after restarting', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ron-voice-ui-'));
  let app = await launch(dir); let page = await app.firstWindow();
  await expect(page.locator('#ask')).toBeEnabled();
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('listening:available');
    ipcMain.handle('listening:available', () => { throw new Error('Microphone enable must not launch a separate probe.'); });
  });
  await expect(page.locator('#listening-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#listening-toggle').click();
  await expect(page.locator('#listening-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#question').fill('My typed draft');
  const transcript = async text => app.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0].webContents.send('listening:update', { state: 'transcript', text: value }), text);
  await transcript('A voice question');
  await expect(page.locator('#question')).toHaveValue('My typed draft');
  await expect(page.locator('#toast')).toContainText('draft was kept');
  await page.locator('#question').fill('');
  await transcript('Explain 17 times 19');
  await expect(page.locator('#heard-question')).toContainText('Explain 17 times 19');
  await expect(page.locator('#final-answer')).toContainText('323');
  await page.locator('#listening-toggle').click();
  await expect(page.locator('#listening-toggle')).toHaveAttribute('aria-pressed', 'false');
  await transcript('Do not send this after the microphone is off');
  await expect(page.locator('#heard-question')).not.toContainText('Do not send');
  await app.close();
  app = await launch(dir); page = await app.firstWindow();
  await expect(page.locator('#listening-toggle')).toHaveAttribute('aria-pressed', 'false');
});

test('project panel previews source and installed archive with explicit sharing', async () => {
  test.skip(!await fs.access('C:\\dev\\ron-assistant\\package.json').then(() => true).catch(() => false), 'The granted local project folders are specific to Ron’s computer.');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ron-project-ui-'));
  const app = await launch(dir); const page = await app.firstWindow();
  await expect(page.locator('#ask')).toBeEnabled();
  await page.locator('#project-open').click();
  await expect(page.locator('#project-list')).toContainText('C:\\dev\\ron-assistant');
  await expect(page.locator('#project-list')).toContainText('E:\\Program Files\\Ron Assistant');
  await page.locator('[data-project-preview="source:package.json"]').click();
  await expect(page.locator('#project-preview')).toHaveValue(/ron-assistant/);
  const archive = page.locator('[data-project-preview="installed:resources/app.asar/main.cjs"]');
  await expect(archive).toBeVisible();
  await archive.click();
  await expect(page.locator('#project-preview')).toHaveValue(/BrowserWindow/);
  await page.locator('[data-project-id="source:package.json"]').check();
  await page.locator('#project-use').click();
  await expect(page.locator('#project-summary')).toContainText('1 project');
  await page.locator('#question').fill('Review the attached package file'); await page.locator('#ask').click();
  await expect(page.locator('#final-answer')).toBeVisible();
  const run = await page.evaluate(async () => (await window.ron.bootstrap()).current);
  expect(run.projectIds).toEqual(['source:package.json']);
  expect(run.projectFiles[0].path).toBe('C:\\dev\\ron-assistant\\package.json');
  await expect(page.evaluate(() => window.ron.previewProjectFile('source:../../Users/Luken/.env'))).rejects.toThrow();
  await expect(page.locator('#project-summary')).toContainText('No project');
  await expect(page.locator('#project-used')).toContainText('package.json');
});

test('packaged application launches with isolated settings and its compiled interface', async () => {
  test.skip(!process.env.RON_PACKAGED_TEST, 'Run after Windows packaging.');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ron-assistant-packaged-'));
  const app = await launch(dir, true); const page = await app.firstWindow();
  page.on('pageerror', error => console.error('Packaged renderer error:', error.message));
  await expect(page.locator('h1')).toHaveText('Conversation');
  expect(await page.evaluate(async () => (await window.ron.bootstrap()).testMode)).toBe(false);
  expect(typeof await page.evaluate(() => window.ron.listeningAvailable())).toBe('boolean');
  await expect(page.locator('#listening-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#instructions')).toHaveValue(/My name is Ron/);
  if (process.env.RON_LIVE_DESKTOP_TEST === '1') {
    test.setTimeout(240000);
    await expect(page.locator('#ask')).toBeEnabled({ timeout: 20000 });
    await page.locator('#question').fill('Explain why 23 times 7 equals 161. Keep the final answer to one sentence.');
    await page.locator('#ask').click();
    await expect(page.locator('#results')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-answer')).toContainText('161', { timeout: 210000 });
    await expect(page.locator('#status-line')).toHaveText('Your answers are ready.');
    await page.locator('.final-card [data-format="plain"]').click();
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toContain('161');
    await page.screenshot({ path: path.join(root, 'work', 'packaged-real-answer.png'), fullPage: true });
    await fs.writeFile(path.join(root, 'work', 'packaged-real-answer.txt'), await page.locator('#results').innerText());
    if (process.env.RON_AVATAR_TEST === '1') {
      await page.locator('#voice-toggle').click();
      await page.locator('#connect-avatar').click();
      await expect(page.locator('#avatar-status')).toHaveText(/^Live ·|.*Windows voice.*/s, { timeout: 120000 });
      const avatarText = await page.locator('#avatar-status').innerText();
      await fs.writeFile(path.join(root, 'work', 'avatar-test-status.txt'), avatarText);
      if (avatarText.startsWith('Live')) {
        await expect.poll(() => page.locator('#avatar-video').evaluate(video => video.videoWidth), { timeout: 15000 }).toBeGreaterThan(0);
        await page.locator('#speak-avatar').click();
        await expect(page.locator('#avatar-status')).toContainText('Final answer sent');
      }
      await page.screenshot({ path: path.join(root, 'work', 'avatar-test.png'), fullPage: true });
      await page.locator('#disconnect-avatar').click().catch(() => {});
    }
  }
  await page.screenshot({ path: path.join(root, 'work', 'packaged-smoke.png'), fullPage: true });
  await app.close();
});
