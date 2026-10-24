// node tools/test-board.cjs <playwright-core module path> [artifact directory]
// All GitHub/widget responses are mocked; no posts, comments, or logins are sent.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright-core');
const root = path.resolve(__dirname, '..');
const output = process.argv[3];
const sample = `<h2>Markdown 예제</h2><p><strong>굵게</strong>와 <em>기울임</em>, <del>취소선</del></p>
<ul><li>목록</li><li><input type="checkbox" checked> 작업 완료</li></ul>
<table><thead><tr><th>보드</th><th>크기</th></tr></thead><tbody><tr><td>CMD</td><td>5×7</td></tr></tbody></table>
<blockquote><p>인용문</p></blockquote><pre><code>main:\n    PuTTY &lt;&lt; "/rHello &lt;CMD&gt;"</code></pre>
<p>/rRED_TOKEN /oORANGE_TOKEN /#FF00FFMAGENTA_TOKEN /d1DEFAULT_TOKEN</p>
<p>$rBG_RED $#FF00FFBG_MAGENTA /d1BG_RESET</p>
<p>/rBEFORE <strong>BOLD_RED</strong> AFTER /d1INLINE_RESET</p>
<p>/g$#112233COLORED_LINE\nRESET_LINE</p>
<p>/rRED_BR<br>BR_RESET</p><p>PARAGRAPH_RESET</p>
<p>//r LITERAL_SLASH $$r LITERAL_DOLLAR /RPALE_RED</p>
<p><code>/rCODE_LITERAL $rCODE_BACKGROUND //</code> <a href="https://example.com/red/$r">https://example.com/red/$r</a></p>
<details><summary>펼쳐 보기</summary><p>세부 내용</p></details><a href="https://github.com/example">안전한 링크</a>
<script>window.__unsafe = 1</script><a href="javascript:alert(1)" onclick="window.__unsafe=1">위험 링크</a>
<img src="javascript:alert(1)" onerror="window.__unsafe=1"><iframe src="https://example.com"></iframe><form><input></form><svg onload="window.__unsafe=1"></svg>`;
function issue(number) {
  return { number, title: `게시글 ${number} · <테스트>`, body: 'raw', body_html: sample,
    created_at: `2026-10-${String(Math.min(number, 24)).padStart(2, '0')}T10:00:00Z`,
    state: number % 2 ? 'closed' : 'open', comments: 21, user: { login: 'tester' },
    locked: number === 25, labels: [{ name: '질문' }] };
}
const issues = Array.from({ length: 25 }, (_, i) => issue(25 - i));
const comments = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, user: { login: `user${i + 1}` }, created_at: '2026-10-24T00:00:00Z', body_html: `<p>댓글 <strong>${i + 1}</strong> /rCOMMENT_RED\nCOMMENT_DEFAULT</p>` }));
const server = http.createServer((req, res) => {
  const filename = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' }[path.extname(filename)] || 'text/plain');
  res.end(fs.readFileSync(filename));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let searchFailure = false, commentFailure = false;
    await page.route('https://**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'api.github.com') {
        if (url.pathname === '/search/issues') {
          assert.equal(url.searchParams.get('q'), 'repo:P-D-Starlit/Starlit_7_AI is:issue');
          assert.equal(url.searchParams.get('sort'), 'created'); assert.equal(url.searchParams.get('order'), 'desc');
          if (searchFailure) return route.fulfill({ status: 403, json: {} });
          const size = Number(url.searchParams.get('per_page')), index = Number(url.searchParams.get('page'));
          return route.fulfill({ json: { total_count: 25, items: issues.slice((index - 1) * size, index * size) } });
        }
        if (url.pathname.endsWith('/comments')) {
          if (commentFailure) return route.fulfill({ status: 403, json: {} });
          const index = Number(url.searchParams.get('page'));
          return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Link', ...(index === 1 ? { Link: '<https://api.github.com/next>; rel="next"' } : {}) }, json: comments.slice((index - 1) * 20, index * 20) });
        }
        const number = Number(url.pathname.split('/').at(-1));
        if (number === 999) return route.fulfill({ status: 404, json: {} });
        return route.fulfill({ json: issue(number) });
      }
      if (url.hostname === 'utteranc.es') return route.fulfill({ contentType: 'application/javascript', body: `const s=document.currentScript;const f=document.createElement('iframe');f.title='GitHub comment composer';f.dataset.issue=s.getAttribute('issue-number');f.dataset.repo=s.getAttribute('repo');f.dataset.theme=s.getAttribute('theme');s.parentElement.append(f);` });
      return route.abort();
    });
    const base = `http://127.0.0.1:${server.address().port}/board.html`;
    await page.goto(base); await page.waitForFunction(() => document.querySelectorAll('#board-list>li').length === 10);
    assert.equal(await page.locator('#board-previous').getAttribute('aria-disabled'), 'true');
    await page.locator('#board-list .board-post').first().click();
    await page.locator('#board-reader').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#comments-compose').isDisabled(), true);
    await page.locator('#board-list .board-post').nth(1).click();
    await page.waitForFunction(() => document.getElementById('board-post-heading').textContent.includes('24'));
    await page.waitForFunction(() => document.querySelectorAll('.board-comment').length === 20);
    assert.equal(await page.locator('#board-post-body table').count(), 1);
    assert.equal(await page.locator('#board-post-body script, #board-post-body iframe, #board-post-body svg, #board-post-body form, #board-post-body [onclick], #board-post-body [onerror], #board-post-body a[href^="javascript:"]').count(), 0);
    assert.equal(await page.evaluate(() => window.__unsafe), undefined);
    assert.equal(await page.locator('#board-post-body input').isDisabled(), true);
    assert.equal(await page.locator('#board-post-body input').isChecked(), true);
    assert.match(await page.locator('#board-post-body pre').textContent(), /Hello <CMD>/);
    const colored = await page.locator('#board-post-body').evaluate(root => [...root.querySelectorAll('.starlit-text-color')].map(node => ({ text: node.textContent.trim(), color: node.style.color, background: node.style.backgroundColor })));
    const colorOf = text => colored.find(run => run.text === text);
    assert.equal(colorOf('RED_TOKEN').color, 'rgb(255, 0, 0)');
    assert.equal(colorOf('ORANGE_TOKEN').color, 'rgb(255, 128, 0)');
    assert.equal(colorOf('MAGENTA_TOKEN').color, 'rgb(255, 0, 255)');
    assert.equal(colorOf('BG_RED').background, 'rgb(255, 0, 0)');
    assert.equal(colorOf('BG_MAGENTA').background, 'rgb(255, 0, 255)');
    assert.equal(colorOf('BOLD_RED').color, 'rgb(255, 0, 0)');
    assert.equal(colorOf('PALE_RED').color, 'rgb(255, 85, 85)');
    for (const text of ['DEFAULT_TOKEN', 'BG_RESET', 'INLINE_RESET', 'RESET_LINE', 'BR_RESET', 'PARAGRAPH_RESET']) assert.equal(colorOf(text), undefined);
    assert.match(await page.locator('#board-post-body').textContent(), /\/r LITERAL_SLASH \$r LITERAL_DOLLAR/);
    assert.equal(await page.locator('#board-post-body code').last().textContent(), '/rCODE_LITERAL $rCODE_BACKGROUND //');
    assert.equal(await page.locator('#board-post-body a[href="https://example.com/red/$r"]').textContent(), 'https://example.com/red/$r');
    assert.equal(await page.locator('.board-comment').first().locator('.starlit-text-color').textContent(), 'COMMENT_RED');
    await page.locator('#board-colors-enabled').uncheck();
    assert.equal(await page.locator('.board-markdown .starlit-text-color').count(), 0);
    assert.match(await page.locator('#board-post-body').textContent(), /\/rRED_TOKEN/);
    assert.match(await page.locator('.board-comment').first().textContent(), /\/rCOMMENT_RED/);
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.board-comment').length === 20);
    assert.equal(await page.locator('#board-colors-enabled').isChecked(), false);
    await page.locator('#board-colors-enabled').check();
    assert.equal(await page.locator('#board-post-body .starlit-text-color').filter({ hasText: /^RED_TOKEN\s*$/ }).count(), 1);
    await page.locator('#comments-more').click();
    await page.waitForFunction(() => document.querySelectorAll('.board-comment').length === 21);
    await page.locator('#comments-compose').click();
    await page.locator('#comments-widget iframe').waitFor();
    assert.equal(await page.locator('#comments-widget iframe').getAttribute('data-issue'), '24');
    assert.equal(await page.locator('#comments-widget iframe').getAttribute('data-theme'), 'github-dark');
    await page.locator('#comments-compose').click();
    await page.waitForFunction(() => document.querySelectorAll('.board-comment').length === 20);
    await page.locator('#board-page-size').selectOption('20');
    await page.waitForFunction(() => document.querySelectorAll('#board-list>li').length === 20);
    assert.match(page.url(), /issue=24&page=1&size=20/);
    await page.locator('#board-next').click();
    await page.waitForFunction(() => document.querySelectorAll('#board-list>li').length === 5);
    assert.equal(await page.locator('#board-reader').isVisible(), true);
    await page.goBack(); await page.waitForFunction(() => document.querySelectorAll('#board-list>li').length === 20);
    await page.locator('#board-post-heading').scrollIntoViewIfNeeded();
    if (output) { fs.mkdirSync(output, { recursive: true }); await page.screenshot({ path: path.join(output, 'board-desktop.png'), fullPage: true }); }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (output) await page.screenshot({ path: path.join(output, 'board-mobile.png'), fullPage: true });
    await page.goto(`${base}?issue=999&page=2&size=10`);
    await page.waitForFunction(() => document.getElementById('board-reader-status').textContent.includes('찾을 수'));
    await page.waitForFunction(() => document.querySelectorAll('#board-list>li').length === 10);
    assert.equal(await page.locator('#board-reader').isVisible(), false);
    await page.goto(`${base}?issue=1&page=100&size=10`);
    await page.waitForURL(/page=3/);
    await page.waitForFunction(() => document.querySelectorAll('#board-list>li').length === 5);
    commentFailure = true; await page.locator('#comments-refresh').click();
    await page.waitForFunction(() => document.getElementById('comments-status').textContent.includes('요청 한도'));
    searchFailure = true; await page.locator('#board-refresh').click();
    await page.waitForFunction(() => document.getElementById('board-status').textContent.includes('요청 한도'));
    assert.equal(await page.locator('#board-reader').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: Starlit foreground/background colors, resets, escapes, code/URL preservation, persistent toggle, Markdown safety, local reading, pagination, comments, history and mobile layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
