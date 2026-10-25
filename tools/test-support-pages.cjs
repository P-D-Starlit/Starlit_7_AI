// node tools/test-support-pages.cjs <playwright-core path> [artifact directory]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright-core');
const root = path.resolve(__dirname, '..'), artifacts = process.argv[3];
const pages = fs.readdirSync(root).filter(name => name.endsWith('.html'));
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' }[path.extname(file)] || 'text/plain; charset=utf-8');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://api.github.com/**', route => route.fulfill({ json: { total_count: 0, items: [] } }));
    const base = `http://127.0.0.1:${server.address().port}/`;
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      for (const name of pages) {
        await page.goto(base + name);
        const nav = page.locator('header .home-nav');
        assert.deepEqual(await nav.locator('a').allTextContents(), ['설치', '기술지원', '하드웨어', '게시판'], name);
        assert.equal(await nav.locator('a').last().getAttribute('href'), 'board.html');
        const box = await nav.boundingBox();
        assert.ok(box.x >= -1 && box.x + box.width <= width + 1, `${name}: header overflow at ${width}`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: body overflow at ${width}`);
      }
    }
    await page.goto(base + 'support.html');
    const cards = page.locator('.support-card');
    assert.equal(await cards.count(), 6);
    assert.equal(await cards.nth(4).locator('.menu-number').textContent(), '05');
    assert.equal(await cards.nth(4).getAttribute('href'), 'smd_viewer.html');
    assert.equal(await cards.nth(5).locator('.menu-number').textContent(), '06');
    await cards.nth(4).click();
    await page.waitForURL('**/smd_viewer.html');
    for (const id of ['overview', 'windows', 'vscode', 'smd', 'android', 'help']) {
      await page.locator(`#topic-${id}`).click();
      assert.equal(await page.locator('.guide-panel:visible').count(), 1);
      assert.equal(await page.locator(`#${id}`).isVisible(), true);
    }
    assert.equal(await page.locator('a[href="examples/smd-viewer/sample.smd"]').getAttribute('download'), '');
    await page.locator('#topic-vscode').click();
    if (artifacts) {
      fs.mkdirSync(artifacts, { recursive: true });
      await page.screenshot({ path: path.join(artifacts, 'smd-guide-desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(artifacts, 'smd-guide-mobile.png'), fullPage: true });
      await page.goto(base + 'unpack.html');
      await page.screenshot({ path: path.join(artifacts, 'unpacked-header-mobile.png') });
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: ${pages.length} pages at 320/390/768/1440px, four header links, no overflow, support order, six SMD topics and no JS errors.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
