/* Autonomous QA: evidence-first, never silently treat blocked or untested flows as PASS. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve('qa-artifacts');
fs.mkdirSync(out, { recursive: true });
const url = process.env.QA_URL;
const report = { url, started: new Date().toISOString(), checks: [], limitations: [], sha: process.env.GITHUB_SHA };
const record = (name, status, detail) => { report.checks.push({ name, status, detail }); console.log(status + ' ' + name + ': ' + detail); };
let browser;
async function shot(page, name) {
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }).catch(e => record('screenshot ' + name, 'ERROR', e.message));
}
async function main() {
  assert.ok(url && /^https:\/\//.test(url), 'QA_URL must be HTTPS');
  browser = await chromium.launch({ headless: true });
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ viewport: { width: 1365, height: 900 }, ignoreHTTPSErrors: false })));
  try {
    const pages = await Promise.all(contexts.map(c => c.newPage()));
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1500);
      await shot(page, 'client-' + (i + 1) + '-landing');
      const text = (await page.locator('body').innerText().catch(() => '')).slice(0, 3500);
      const title = await page.title();
      const blocked = /authentication required|vercel authentication|log in to vercel|sign in to vercel|deployment protection|401 unauthorized|access denied/i.test(title + ' ' + text);
      if (blocked || response?.status() === 401 || response?.status() === 403) {
        record('client-' + (i + 1) + ' preview access', 'FAIL', 'Protected/unauthorized preview (HTTP ' + response?.status() + '): ' + title);
        throw new Error('QA preview requires authentication; cannot claim browser validation');
      }
      assert.ok(response?.ok(), 'HTTP ' + response?.status() + ' on client ' + (i + 1));
      record('client-' + (i + 1) + ' preview access', 'PASS', 'HTTP ' + response.status() + '; ' + title);
      assert.ok(text.length > 30, 'Empty or near-empty application body');
      record('client-' + (i + 1) + ' visible app', 'PASS', 'Visible body length ' + text.length);
    }
    const first = pages[0];
    const body = await first.locator('body').innerText();
    const guandan = /掼蛋|guandan|惯蛋/i.test(body);
    assert.ok(guandan, 'No Guandan entry visible');
    record('Guandan entry visible', 'PASS', 'Text matched');
    const join = first.getByRole('button', { name: /加入房间|进入房间|加入|进入|开始游戏/i }).first();
    if (await join.count()) {
      const disabled = await join.isDisabled();
      record('entry button present', disabled ? 'FAIL' : 'PASS', disabled ? 'Button disabled' : 'Button enabled');
      assert.ok(!disabled, 'Entry button disabled');
    } else {
      record('entry button present', 'UNVERIFIED', 'No matching button; requires UI selector mapping');
    }
    for (const name of ['robot 2 dynamic overlay avoidance', 'play/pass real interaction', 'tribute and anti-tribute timing', 'last trick visibility', '10-second dealing', '4 clients 3 complete games', 'reconnect room-state recovery']) {
      record(name, 'UNVERIFIED', 'Requires deterministic room setup and UI/network test hooks; not simulated by smoke test');
    }
  } finally {
    await Promise.all(contexts.map(c => c.close()));
  }
}
main().catch(e => { record('autonomous browser gate', 'FAIL', e.stack || e.message); process.exitCode = 1; })
.finally(async () => { if (browser) await browser.close(); report.finished = new Date().toISOString(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); if (report.checks.some(x => x.status === 'UNVERIFIED')) { console.error('Incomplete acceptance: smoke checks cannot approve production.'); process.exitCode = 1; } });
