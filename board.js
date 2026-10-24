(() => {
  const { repository, renderMarkdown, readRoute, routeURL, isIssue } = window.StarlitBoard;
  const get = id => document.getElementById(id);
  const list = get('board-list'), status = get('board-status'), refresh = get('board-refresh');
  const reader = get('board-reader'), readerStatus = get('board-reader-status');
  const comments = get('board-comments'), commentList = get('comments-list'), commentStatus = get('comments-status');
  const compose = get('comments-compose'), widget = get('comments-widget'), more = get('comments-more');
  const cache = new Map();
  let route = readRoute(location.href), totalPages = 1;
  let listRun = 0, readerRun = 0, commentRun = 0, widgetRun = 0;
  let displayedIssue = 0, commentPage = 0, commentsLoading = false, composerOpen = false;
  let currentIssue = null;
  refresh.hidden = false;
  const colorOption = get('board-colors-enabled');
  colorOption.checked = window.StarlitBoard.colorsEnabled();
  colorOption.addEventListener('change', () => window.StarlitBoard.setColorEnabled(colorOption.checked));

  function element(tag, className, text) {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function external(node, href) { node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer'; node.referrerPolicy = 'no-referrer'; return node; }
  function issueURL(number) { return `https://github.com/${repository}/issues/${number}`; }
  function dateNode(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return element('span', '', '날짜 미상');
    const time = element('time', '', new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date));
    time.dateTime = date.toISOString(); return time;
  }
  function metadata(issue) {
    const meta = element('div', 'board-post-meta');
    meta.append(element('span', `board-state${issue.state === 'closed' ? ' closed' : ''}`, issue.state === 'closed' ? '종료' : '진행 중'));
    meta.append(element('span', '', `#${issue.number} · ${issue.user?.login || 'GitHub 사용자'}`), dateNode(issue.created_at));
    meta.append(element('span', '', `댓글 ${Number.isInteger(issue.comments) ? issue.comments : 0}`));
    for (const label of (Array.isArray(issue.labels) ? issue.labels : []).slice(0, 3)) {
      const name = typeof label === 'string' ? label : label?.name;
      if (typeof name === 'string') meta.append(element('span', 'board-label', name));
    }
    return meta;
  }
  async function request(path, force = false) {
    const hit = cache.get(path);
    if (!force && hit && Date.now() - hit.time < 45000) return hit.value;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`https://api.github.com/${path}`, {
        headers: { Accept: 'application/vnd.github.full+json' }, credentials: 'omit', signal: controller.signal
      });
      if (!response.ok) throw new Error(response.status === 404 ? '글이 삭제되었거나 찾을 수 없습니다.'
        : [403, 429].includes(response.status) ? 'GitHub 요청 한도에 도달했거나 접근할 수 없습니다. 잠시 후 다시 시도하세요.'
          : 'GitHub 데이터를 불러오지 못했습니다.');
      const result = { data: await response.json(), next: /<[^>]+>;\s*rel="next"/.test(response.headers.get('link') || '') };
      cache.set(path, { time: Date.now(), value: result }); return result;
    } finally { clearTimeout(timer); }
  }
  function message(error) {
    if (error?.name === 'AbortError') return '요청 시간이 초과되었습니다. 다시 시도해 주세요.';
    if (error instanceof TypeError) return '인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
    return error?.message || '데이터를 불러오지 못했습니다.';
  }
  function localLink(link, nextRoute, scroll) {
    link.href = routeURL(nextRoute);
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); navigate(nextRoute, scroll);
    });
  }
  function renderListIssue(issue) {
    const item = element('li', ''), link = element('a', 'board-post');
    if (issue.number === route.issue) link.setAttribute('aria-current', 'page');
    localLink(link, { ...route, issue: issue.number }, 'post');
    link.append(element('strong', 'board-post-title', issue.title), metadata(issue)); item.append(link); return item;
  }
  function pagerLink(id, nextPage, disabled) {
    const link = get(id); link.replaceWith(link.cloneNode(true));
    const current = get(id);
    current.setAttribute('aria-disabled', String(disabled)); current.tabIndex = disabled ? -1 : 0;
    if (disabled) { current.removeAttribute('href'); return; }
    localLink(current, { ...route, page: nextPage }, 'list');
  }
  async function loadList(force = false) {
    const run = ++listRun, snapshot = { ...route };
    refresh.disabled = true; list.setAttribute('aria-busy', 'true'); status.textContent = '최신순으로 글 목록을 불러오는 중입니다.';
    try {
      const query = new URLSearchParams({ q: `repo:${repository} is:issue`, sort: 'created', order: 'desc', per_page: snapshot.size, page: snapshot.page });
      const { data } = await request(`search/issues?${query}`, force);
      if (run !== listRun) return;
      if (!Array.isArray(data.items) || !Number.isSafeInteger(data.total_count) || data.total_count < 0) throw new Error('글 목록 응답 형식이 올바르지 않습니다.');
      const total = data.total_count; totalPages = Math.max(1, Math.ceil(Math.min(total, 1000) / route.size));
      if (route.page > totalPages) { navigate({ ...route, page: totalPages }, '', true); return; }
      list.replaceChildren(...data.items.filter(isIssue).map(renderListIssue)); list.hidden = list.childElementCount === 0;
      status.textContent = total ? `전체 ${total.toLocaleString('ko-KR')}개 · 최신 작성순${data.incomplete_results ? ' · 일부 검색 결과가 지연될 수 있습니다.' : ''}${total > 1000 ? ' · 최근 1,000개까지 조회됩니다. 전체 기록은 GitHub에서 확인하세요.' : ''}` : '아직 게시글이 없습니다. 첫 글을 남겨 주세요.';
      get('board-pagination').hidden = total === 0;
      get('board-page-info').textContent = `${route.page} / ${totalPages} 페이지`;
      pagerLink('board-previous', route.page - 1, route.page <= 1); pagerLink('board-next', route.page + 1, route.page >= totalPages);
    } catch (error) {
      if (run !== listRun) return;
      list.replaceChildren(); list.hidden = true; get('board-pagination').hidden = true;
      status.textContent = `${message(error)} 위의 GitHub 전체 글 보기 링크도 이용할 수 있습니다.`;
    } finally { if (run === listRun) { refresh.disabled = false; list.setAttribute('aria-busy', 'false'); } }
  }
  function closeComposer() {
    widgetRun++; composerOpen = false; widget.replaceChildren(); widget.hidden = true;
    commentList.hidden = false; compose.textContent = currentIssue?.locked ? '잠긴 글 · 댓글 작성 불가' : 'GitHub 로그인 · 댓글 쓰기';
  }
  async function loadComments(append = false) {
    if (append && commentsLoading) return;
    const run = ++commentRun, number = displayedIssue, page = append ? commentPage + 1 : 1;
    if (!number) return;
    commentsLoading = true; more.disabled = true; get('comments-refresh').disabled = true;
    commentStatus.textContent = '댓글을 불러오는 중입니다.';
    if (!append) { commentList.replaceChildren(); commentPage = 0; more.hidden = true; }
    try {
      const { data, next } = await request(`repos/${repository}/issues/${number}/comments?per_page=20&page=${page}`, !append);
      if (run !== commentRun || number !== displayedIssue) return;
      if (!Array.isArray(data)) throw new Error('댓글 응답 형식이 올바르지 않습니다.');
      for (const comment of data) {
        const card = element('article', 'board-comment'), head = element('div', 'board-comment-head');
        head.append(element('strong', '', comment.user?.login || 'GitHub 사용자'), dateNode(comment.created_at));
        const content = element('div', 'board-markdown'); renderMarkdown(content, comment);
        card.append(head, content); commentList.append(card);
      }
      commentPage = page; more.hidden = !next || composerOpen;
      commentStatus.textContent = commentList.childElementCount ? `${commentList.childElementCount}개의 댓글을 표시합니다.` : '아직 댓글이 없습니다. 첫 댓글을 남겨 주세요.';
    } catch (error) { if (run === commentRun) commentStatus.textContent = message(error); }
    finally { if (run === commentRun) { commentsLoading = false; more.disabled = false; get('comments-refresh').disabled = false; } }
  }
  async function loadPost(force = false, scroll = false) {
    const number = route.issue;
    if (!force && number && number === displayedIssue) return;
    const run = ++readerRun; ++commentRun; closeComposer();
    displayedIssue = 0; currentIssue = null; reader.hidden = true; comments.hidden = true; commentList.replaceChildren();
    if (!number) { readerStatus.textContent = ''; document.title = '게시판 | Star-lit7 AI'; return; }
    readerStatus.textContent = `#${number} 게시글을 불러오는 중입니다.`;
    try {
      const { data: issue } = await request(`repos/${repository}/issues/${number}`, force);
      if (run !== readerRun || number !== route.issue) return;
      if (!isIssue(issue)) throw new Error('게시글이 아닌 항목입니다.');
      displayedIssue = number; currentIssue = issue;
      get('board-post-heading').textContent = issue.title;
      get('board-post-meta').replaceChildren(metadata(issue)); renderMarkdown(get('board-post-body'), issue);
      external(get('board-source'), issueURL(number)); external(get('comments-github'), `${issueURL(number)}#new_comment_field`);
      get('board-back').href = routeURL({ ...route, issue: 0 });
      compose.disabled = !!issue.locked; compose.textContent = issue.locked ? '잠긴 글 · 댓글 작성 불가' : 'GitHub 로그인 · 댓글 쓰기';
      reader.hidden = false; comments.hidden = false; readerStatus.textContent = '';
      document.title = `${issue.title} | Starlit 게시판`; loadComments();
      if (scroll) { get('board-post-heading').focus({ preventScroll: true }); reader.scrollIntoView({ behavior: 'auto', block: 'start' }); }
      if (new URL(location.href).searchParams.has('utterances') && !issue.locked) openComposer();
    } catch (error) { if (run === readerRun) readerStatus.textContent = `${message(error)} 아래 목록에서 다른 글을 선택할 수 있습니다.`; }
  }
  function openComposer() {
    if (!displayedIssue || currentIssue?.locked) return;
    if (!['https:', 'http:'].includes(location.protocol)) {
      commentStatus.textContent = 'GitHub 로그인 댓글은 HTTP(S)로 열린 사이트에서 사용할 수 있습니다. 지금은 아래 GitHub 댓글 링크를 이용해 주세요.'; return;
    }
    const run = ++widgetRun, number = displayedIssue;
    composerOpen = true; widget.hidden = false;
    const mount = element('div', ''); widget.replaceChildren(mount);
    const script = document.createElement('script');
    script.src = 'https://utteranc.es/client.js'; script.async = true; script.crossOrigin = 'anonymous';
    script.setAttribute('repo', repository); script.setAttribute('issue-number', String(number)); script.setAttribute('theme', 'github-dark');
    script.onload = () => {
      if (run !== widgetRun || number !== displayedIssue) return;
      commentList.hidden = true; more.hidden = true;
      commentStatus.textContent = '아래 GitHub 로그인 창에서 댓글을 작성하세요. 작성창에는 기존 댓글도 함께 표시됩니다.';
    };
    script.onerror = () => {
      if (run !== widgetRun) return;
      closeComposer(); commentStatus.textContent = '댓글 로그인 창을 불러오지 못했습니다. 아래 GitHub 댓글 링크를 이용해 주세요.';
    };
    mount.append(script); compose.textContent = '작성창 닫기 · 댓글 새로고침';
    commentStatus.textContent = 'GitHub 로그인 댓글 창을 여는 중입니다. 최초 연결은 저장소의 Utterances 앱 설치가 필요합니다.';
  }
  function navigate(next, scroll = '', replace = false) {
    history[replace ? 'replaceState' : 'pushState'](null, '', routeURL(next)); route = readRoute(location.href); sync(scroll);
  }
  function sync(scroll = '', force = false) {
    get('board-page-size').value = String(route.size);
    loadList(force); loadPost(force, scroll === 'post');
    get('board-back').href = routeURL({ ...route, issue: 0 });
    if (scroll === 'list') get('posts-title').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  get('board-back').addEventListener('click', event => {
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate({ ...route, issue: 0 }, 'list'); }
  });
  get('board-page-size').addEventListener('change', event => navigate({ ...route, page: 1, size: event.target.value === '20' ? 20 : 10 }, 'list'));
  refresh.addEventListener('click', () => sync('', true));
  get('comments-refresh').addEventListener('click', () => { closeComposer(); loadComments(); });
  more.addEventListener('click', () => loadComments(true));
  compose.addEventListener('click', () => { if (composerOpen) { closeComposer(); loadComments(); } else openComposer(); });
  window.addEventListener('popstate', () => { route = readRoute(location.href); sync(); });
  sync();
})();
