const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = { window: {}, URL, URLSearchParams, localStorage: { getItem: () => null } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'board-content.js'), 'utf8'), context);
const { colorRuns, palette } = context.window.StarlitBoard;
const runs = text => JSON.parse(JSON.stringify(colorRuns(text)));
const output = text => runs(text).map(run => run.text).join('');
assert.equal(Object.keys(palette).length, 28);
for (const [symbol, color] of Object.entries(palette)) {
  assert.equal(runs(`/${symbol}text`)[0].color, color);
  assert.equal(runs(`$${symbol}text`)[0].background, color);
}
assert.equal(palette.r, '#FF0000'); assert.equal(palette.o, '#FF8000');
assert.equal(runs('/#ff00ffpink')[0].color, '#FF00FF');
assert.equal(runs('$#ff00ffpink')[0].background, '#FF00FF');
assert.deepEqual(runs('/r$rred/d1normal').map(r => [r.text, r.color, r.background]), [['red', '#FF0000', '#FF0000'], ['normal', null, null]]);
for (const newline of ['\n', '\r', '\r\n']) {
  const result = runs(`/r$rred${newline}normal`);
  assert.equal(result.at(-1).color, null); assert.equal(result.at(-1).background, null);
  assert.equal(result.at(-1).text, 'normal');
}
assert.equal(runs('/g$rgreen$d1clear').at(-1).color, '#00FF00');
assert.equal(runs('/g$rgreen$d1clear').at(-1).background, null);
assert.equal(output('/d $d /d2 $d2'), '/d $d /d2 $d2');
assert.equal(runs('/rred/dstillred').at(-1).color, '#FF0000');
assert.equal(output('//r $$r //// $$$$'), '/r $r // $$');
assert.equal(output('https://example.com/red/$r mailto:r@example.com'), 'https://example.com/red/$r mailto:r@example.com');
assert.equal(output('/q $#XYZ123 /#bad'), '/q $#XYZ123 /#bad');
const state = { color: null, background: null };
colorRuns('/r', state); assert.equal(colorRuns('bold', state)[0].color, '#FF0000');
colorRuns('\n', state); assert.equal(colorRuns('normal', state)[0].color, null);
console.log('PASS: 28 foreground/background colors, HEX, /d1, $d1, literal /d, all line endings, slash/dollar escaping, URLs, unknown codes and inline state.');
