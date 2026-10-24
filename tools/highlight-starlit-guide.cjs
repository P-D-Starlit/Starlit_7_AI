// Rebuild static guide highlighting with Starlitliter's own default HTML exporter.
// node tools/highlight-starlit-guide.cjs <path-to-Starlitliter> [guide.html] [--check]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const extensionDirectory = process.argv[2];
if (!extensionDirectory) throw new Error('Pass the Starlitliter directory as the first argument.');
const guideArgument = process.argv.slice(3).find(argument => !argument.startsWith('--'));
const guidePath = path.resolve(__dirname, '..', guideArgument || 'starlit_guide.html');
const source = fs.readFileSync(path.join(extensionDirectory, 'extension.js'), 'utf8');
const vscode = {
  ThemeColor: class { constructor(id) { this.id = id; } },
  ColorThemeKind: { Light: 1, Dark: 2, HighContrastLight: 4 },
  Range: class {
    constructor(line, start, endLine, end) {
      this.start = { line, character: start };
      this.end = { line: endLine, character: end };
    }
  },
  window: {
    activeColorTheme: { kind: 2 },
    createTextEditorDecorationType: () => ({ dispose() {} })
  },
  // No saved overrides: use extension defaults, with Color View off.
  workspace: { getConfiguration: () => ({ get: (key, fallback) => fallback }) }
};
const sandbox = {
  require: name => name === 'vscode' ? vscode : require(name),
  module: { exports: {} }, Buffer
};
vm.createContext(sandbox);
vm.runInContext(source + '\nmodule.exports = { createDecorations, getHighlightedHtml, disposeDecorations };', sandbox);
const api = sandbox.module.exports;

function decode(text) {
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity, name) => {
    if (name.startsWith('#')) return String.fromCodePoint(
      name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
    );
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name.toLowerCase()];
  });
}

function plainCode(html) {
  return decode(html.replace(/<span\b[^>]*>|<\/span>/g, ''));
}

let examples = 0;
const original = fs.readFileSync(guidePath, 'utf8');
let result = original.replace(/<code\b([^>]*)>([\s\S]*?)<\/code>/g, (_, attributes, content) => {
  const text = plainCode(content);
  const lines = text.split(/\r\n|\r|\n/);
  const uri = { path: `/guide-example-${++examples}.sl7`, toString() { return this.path; } };
  const editor = {
    document: { uri, languageId: 'starlit', lineCount: lines.length,
      getText: () => text, lineAt: line => ({ text: lines[line] }) },
    options: { tabSize: 4 }
  };
  const decorations = api.createDecorations();
  let highlighted;
  try {
    highlighted = api.getHighlightedHtml(editor, decorations).match(/<code>([\s\S]*?)<\/code>/)[1];
  } finally {
    api.disposeDecorations(decorations);
  }
  // The extension exports LF; keep the guide's original line endings as well.
  const lineEndings = text.match(/\r\n|\r|\n/g) || [];
  let lineEndingIndex = 0;
  highlighted = highlighted.replace(/\n/g, () => lineEndings[lineEndingIndex++]);
  // Highlighting must never change examples, whitespace, or escaped HTML.
  assert.equal(plainCode(highlighted), text);
  if (!/\bclass=/.test(attributes)) attributes += ' class="starlit-highlight"';
  else attributes = attributes.replace(/class="([^"]*)"/, (_, classes) =>
    `class="${[...new Set([...classes.split(/\s+/), 'starlit-highlight'])].join(' ')}"`);
  return `<code${attributes}>${highlighted}</code>`;
});
if (!result.includes('href="starlit-highlighting.css"')) {
  result = result.replace('  <link rel="stylesheet" href="support.css">',
    '  <link rel="stylesheet" href="support.css">\n  <link rel="stylesheet" href="starlit-highlighting.css">');
}
if (process.argv.includes('--check')) assert.equal(result, original, 'Guide highlighting needs to be rebuilt.');
else if (result !== original) fs.writeFileSync(guidePath, result, 'utf8');
console.log(`PASS: ${examples} code fragments match Starlitliter defaults; original text preserved.`);
