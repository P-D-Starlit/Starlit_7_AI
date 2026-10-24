/* GitHub renders Markdown into body_html; only allowlisted content enters the page. */
(() => {
  const repository = 'P-D-Starlit/Starlit_7_AI';
  const tags = new Set('p br hr h1 h2 h3 h4 h5 h6 blockquote pre code strong em del s ul ol li a img table thead tbody tfoot tr th td details summary input div span kbd samp sup sub dl dt dd'.split(' '));
  const discard = new Set('script style iframe object embed form textarea button select option svg math audio video source link meta base template'.split(' '));
  // VIT6 Default.md §1.1–1.2 names; RGB values match Starlitliter's palette.
  const palette = {
    r: '#FF0000', o: '#FF8000', y: '#FFFF00', l: '#80FF00', g: '#00FF00', t: '#00FF80', c: '#00FFFF',
    s: '#0080FF', b: '#0000FF', v: '#8000FF', m: '#FF00FF', p: '#FF0080', w: '#FFFFFF', k: '#000000',
    R: '#FF5555', O: '#FFAA55', Y: '#FFFF55', L: '#AAFF55', G: '#55FF55', T: '#55FFAA', C: '#55FFFF',
    S: '#55AAFF', B: '#5555FF', V: '#AA55FF', M: '#FF55FF', P: '#FF55AA', W: '#AAAAAA', K: '#555555'
  };
  const markdownSources = new WeakMap();
  let colorEnabled = true;
  try { colorEnabled = localStorage.getItem('starlit-board-colors') !== 'off'; } catch { /* Storage is optional. */ }

  function resetColors(state) { state.color = null; state.background = null; }
  function colorRuns(text, state = { color: null, background: null }) {
    const runs = [];
    let buffer = '';
    const flush = () => {
      if (buffer) runs.push({ text: buffer, color: state.color, background: state.background });
      buffer = '';
    };
    for (let i = 0; i < text.length;) {
      // Do not interpret protocol slashes or path segments in printed URLs.
      const url = /^(?:https?:\/\/|mailto:|www\.)[^\s<>]+/i.exec(text.slice(i));
      if (url) { buffer += url[0]; i += url[0].length; continue; }
      if (text[i] === '\r' || text[i] === '\n') {
        flush(); resetColors(state);
        const newline = text[i] === '\r' && text[i + 1] === '\n' ? '\r\n' : text[i];
        runs.push({ text: newline, color: null, background: null }); i += newline.length; continue;
      }
      const prefix = text[i];
      if (prefix !== '/' && prefix !== '$') { buffer += prefix; i++; continue; }
      if (text[i + 1] === prefix) { buffer += prefix; i += 2; continue; }
      if (text[i + 1] === 'd' && text[i + 2] === '1') {
        flush();
        if (prefix === '/') resetColors(state); else state.background = null;
        i += 3; continue;
      }
      const hex = /^[/$]#([0-9a-fA-F]{6})/.exec(text.slice(i));
      const color = hex ? `#${hex[1].toUpperCase()}` : palette[text[i + 1]];
      if (!color) { buffer += prefix; i++; continue; }
      flush(); state[prefix === '/' ? 'color' : 'background'] = color;
      i += hex ? hex[0].length : 2;
    }
    flush(); return runs;
  }
  function applyColors(root) {
    const state = { color: null, background: null };
    const blocks = new Set('p h1 h2 h3 h4 h5 h6 li blockquote pre table tr th td dt dd details summary hr'.split(' '));
    function visit(node) {
      if (node.nodeType === 3) {
        const fragment = document.createDocumentFragment();
        for (const run of colorRuns(node.textContent, state)) {
          if (!run.color && !run.background) { fragment.append(document.createTextNode(run.text)); continue; }
          const span = document.createElement('span'); span.className = 'starlit-text-color'; span.textContent = run.text;
          if (run.color) span.style.color = run.color;
          if (run.background) span.style.backgroundColor = run.background;
          fragment.append(span);
        }
        node.replaceWith(fragment); return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return;
      const tag = node.localName;
      if (tag === 'br' || blocks.has(tag)) resetColors(state);
      // Literal Markdown code remains copyable and documents color commands.
      if (tag !== 'code' && tag !== 'pre') for (const child of [...node.childNodes]) visit(child);
      if (tag === 'br' || blocks.has(tag)) resetColors(state);
    }
    visit(root);
  }
  function setColorEnabled(enabled) {
    colorEnabled = !!enabled;
    try { localStorage.setItem('starlit-board-colors', colorEnabled ? 'on' : 'off'); } catch { /* Continue without persistence. */ }
    for (const target of document.querySelectorAll('.board-markdown')) {
      const source = markdownSources.get(target);
      if (source) renderMarkdown(target, source);
    }
  }
  function safeURL(value, image = false) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, `https://github.com/${repository}/blob/HEAD/`);
      return (image ? ['https:'] : ['https:', 'http:', 'mailto:']).includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }
  function renderMarkdown(target, data) {
    markdownSources.set(target, data);
    const fragment = document.createDocumentFragment();
    if (typeof data.body_html !== 'string') {
      const fallback = document.createElement(data.body ? 'pre' : 'p');
      fallback.textContent = data.body || '내용이 없습니다.'; fragment.append(fallback);
    } else {
      const parsed = new DOMParser().parseFromString(data.body_html, 'text/html');
      function copy(source, parent) {
        if (source.nodeType === 3) { parent.append(document.createTextNode(source.textContent)); return; }
        if (source.nodeType !== 1) return;
        const tag = source.localName.toLowerCase();
        if (discard.has(tag)) return;
        if (!tags.has(tag)) { for (const child of source.childNodes) copy(child, parent); return; }
        if (tag === 'input' && source.getAttribute('type') !== 'checkbox') return;
        if (tag === 'img' && !safeURL(source.getAttribute('src'), true)) return;
        const node = document.createElement(tag);
        if (tag === 'a') {
          const url = safeURL(source.getAttribute('href'));
          if (url) { node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; node.referrerPolicy = 'no-referrer'; }
        }
        if (tag === 'img') {
          node.src = safeURL(source.getAttribute('src'), true); node.alt = source.getAttribute('alt') || '';
          node.loading = 'lazy'; node.decoding = 'async'; node.referrerPolicy = 'no-referrer';
        }
        if (tag === 'input') { node.type = 'checkbox'; node.disabled = true; node.checked = source.hasAttribute('checked'); }
        if (source.hasAttribute('title')) node.title = source.getAttribute('title');
        if (tag === 'ol' && /^\d{1,6}$/.test(source.getAttribute('start') || '')) node.start = Number(source.getAttribute('start'));
        if (tag === 'th' || tag === 'td') {
          const align = source.getAttribute('align');
          if (['left', 'center', 'right'].includes(align)) node.className = `align-${align}`;
        }
        for (const child of source.childNodes) copy(child, node);
        parent.append(node);
      }
      for (const child of parsed.body.childNodes) copy(child, fragment);
      if (!fragment.childNodes.length) { const empty = document.createElement('p'); empty.textContent = '내용이 없습니다.'; fragment.append(empty); }
    }
    if (colorEnabled) applyColors(fragment);
    target.replaceChildren(fragment);
  }
  function positive(value, fallback = 0) {
    if (!/^\d+$/.test(String(value || ''))) return fallback;
    const number = Number(value); return Number.isSafeInteger(number) && number > 0 ? number : fallback;
  }
  function readRoute(href) {
    const params = new URL(href).searchParams, size = params.get('size') === '20' ? 20 : 10;
    return { issue: positive(params.get('issue')), size, page: Math.min(positive(params.get('page'), 1), Math.ceil(1000 / size)) };
  }
  function routeURL(route) {
    const params = new URLSearchParams();
    if (route.issue) params.set('issue', route.issue);
    params.set('page', route.page); params.set('size', route.size); return `board.html?${params}`;
  }
  function isIssue(issue) { return !!(issue && !issue.pull_request && positive(issue.number) && typeof issue.title === 'string'); }
  window.StarlitBoard = { repository, renderMarkdown, readRoute, routeURL, isIssue, safeURL,
    colorRuns, palette, setColorEnabled, colorsEnabled: () => colorEnabled };
})();
