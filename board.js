(() => {
  const repository = 'P-D-Starlit/Starlit_7_AI';
  const list = document.getElementById('board-list');
  const status = document.getElementById('board-status');
  const refresh = document.getElementById('board-refresh');
  if (!list || !status || !refresh) return;
  refresh.hidden = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderIssue(issue) {
    const item = document.createElement('li');
    const link = element('a', 'board-post');
    // Construct links from validated issue numbers; never insert remote HTML.
    link.href = `https://github.com/${repository}/issues/${issue.number}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(element('strong', 'board-post-title', issue.title));
    const meta = element('span', 'board-post-meta');
    const closed = issue.state === 'closed';
    meta.append(element('span', `board-state${closed ? ' closed' : ''}`, closed ? '종료' : '진행 중'));
    meta.append(element('span', '', `#${issue.number} · ${issue.user?.login || 'GitHub 사용자'}`));
    const date = new Date(issue.created_at);
    if (!Number.isNaN(date.getTime())) {
      const time = element('time', '', new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(date));
      time.dateTime = date.toISOString();
      meta.append(time);
    }
    meta.append(element('span', '', `댓글 ${Number.isInteger(issue.comments) ? issue.comments : 0}`));
    for (const label of (Array.isArray(issue.labels) ? issue.labels : []).slice(0, 3)) {
      const name = typeof label === 'string' ? label : label?.name;
      if (typeof name === 'string') meta.append(element('span', 'board-label', name));
    }
    link.append(meta);
    item.append(link);
    return item;
  }

  async function loadIssues() {
    if (refresh.disabled) return;
    refresh.disabled = true;
    list.setAttribute('aria-busy', 'true');
    status.textContent = '최근 글을 불러오는 중입니다.';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`https://api.github.com/repos/${repository}/issues?state=all&sort=created&direction=desc&per_page=30`, {
        headers: { Accept: 'application/vnd.github+json' },
        credentials: 'omit', signal: controller.signal
      });
      if (!response.ok) throw new Error(`GitHub ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid GitHub response');
      // GitHub's issues endpoint also includes pull requests.
      const issues = data.filter(issue => issue && !issue.pull_request
        && Number.isSafeInteger(issue.number) && issue.number > 0
        && typeof issue.title === 'string').slice(0, 20);
      list.replaceChildren(...issues.map(renderIssue));
      list.hidden = issues.length === 0;
      status.textContent = issues.length
        ? `최근 게시글 ${issues.length}개입니다. 글을 선택하면 GitHub 새 탭에서 열립니다. 전체 목록은 위 링크에서 확인하세요.`
        : data.length
          ? '최근 조회 범위에 게시글이 없습니다. GitHub에서 전체 글을 확인하거나 첫 글을 남겨 주세요.'
          : '아직 게시글이 없습니다. 첫 글을 남겨 주세요.';
    } catch {
      status.textContent = '글 목록을 불러오지 못했습니다. 인터넷 연결 또는 GitHub 요청 제한을 확인하세요. 위의 글쓰기·전체 글 보기 링크는 계속 사용할 수 있습니다.';
    } finally {
      clearTimeout(timeout);
      list.setAttribute('aria-busy', 'false');
      refresh.disabled = false;
    }
  }

  refresh.addEventListener('click', loadIssues);
  loadIssues();
})();
