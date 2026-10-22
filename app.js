/* All assets and slide text are local; this file also works with file:// URLs. */
(() => {
  'use strict';
  const slides = [...document.querySelectorAll('.slide-section')];
  const metadata = JSON.parse(document.getElementById('slide-data').textContent);
  const count = slides.length;
  const overview = document.getElementById('overview');
  const search = document.getElementById('search');
  const selector = document.getElementById('page-select');
  const readingButton = document.getElementById('reading-toggle');
  const overviewItems = [...document.querySelectorAll('[data-goto]')];
  let current = 1;
  let reading = false;
  let touchStart = null;
  let scrollFrame = null;
  const clamp = number => Math.min(count, Math.max(1, number));
  const hashNumber = () => clamp(Number(location.hash.match(/^#slide-(\d+)$/)?.[1]) || 1);

  function resize() {
    slides.forEach(slide => {
      const wrap = slide.querySelector('.slide-wrap');
      if (wrap.clientWidth) wrap.style.setProperty('--slide-scale', wrap.clientWidth / 1279.968);
    });
  }
  function updateControls() {
    selector.value = String(current);
    document.getElementById('previous').disabled = current === 1;
    document.getElementById('next').disabled = current === count;
    document.getElementById('progress-fill').style.width = `${current / count * 100}%`;
    overviewItems.forEach(item => {
      if (Number(item.dataset.goto) === current) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
    document.title = `${String(current).padStart(2, '0')} · ${metadata[current - 1].title} — Star-lit 7 AI`;
  }
  function go(number, { updateHash = true, scroll = true } = {}) {
    current = clamp(number);
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i + 1 === current);
      slide.inert = !reading && i + 1 !== current;
    });
    updateControls();
    resize();
    if (updateHash) history.replaceState(null, '', `#slide-${current}`);
    if (scroll) {
      if (reading) slides[current - 1].scrollIntoView({ behavior: 'auto', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'auto' });
    }
    document.getElementById('announcement').textContent = `${current} / ${count}. ${metadata[current - 1].title}`;
  }
  function setReading(value) {
    reading = value;
    document.body.classList.toggle('reading', value);
    readingButton.setAttribute('aria-pressed', String(value));
    readingButton.textContent = value ? '슬라이드 보기' : '이어 보기';
    slides.forEach(slide => { slide.querySelector('.transcript').open = value; });
    go(current);
  }
  function openOverview() {
    search.value = '';
    filterOverview();
    overview.showModal();
    search.focus();
  }
  function filterOverview() {
    const terms = search.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    let visible = 0;
    overviewItems.forEach(item => {
      item.hidden = !terms.every(term => item.dataset.search.includes(term));
      if (!item.hidden) visible++;
    });
    document.querySelector('.no-results').hidden = visible > 0;
    document.getElementById('search-status').textContent = `${visible}개 슬라이드`;
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.body.requestFullscreen) await document.body.requestFullscreen();
    } catch {
      document.getElementById('announcement').textContent = '이 브라우저에서는 전체 화면을 사용할 수 없습니다.';
    }
  }

  document.getElementById('previous').addEventListener('click', () => go(current - 1));
  document.getElementById('next').addEventListener('click', () => go(current + 1));
  selector.addEventListener('change', () => go(Number(selector.value)));
  readingButton.addEventListener('click', () => setReading(!reading));
  document.getElementById('overview-open').addEventListener('click', openOverview);
  document.querySelector('.close-dialog').addEventListener('click', () => overview.close());
  overviewItems.forEach(item => item.addEventListener('click', () => { overview.close(); go(Number(item.dataset.goto)); }));
  search.addEventListener('input', filterOverview);
  overview.addEventListener('click', event => {
    if (event.target !== overview) return;
    const rect = overview.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) overview.close();
  });
  document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    document.getElementById('fullscreen').textContent = document.fullscreenElement ? '전체 화면 종료' : '전체 화면';
    requestAnimationFrame(resize);
  });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey || overview.open || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    const key = event.key.toLowerCase();
    if (event.target.closest('button,summary,a') && (key === ' ' || key === 'enter')) return;
    if (['arrowright','pagedown'].includes(key) || (key === ' ' && !reading)) { event.preventDefault(); go(current + 1); }
    else if (['arrowleft','pageup'].includes(key)) { event.preventDefault(); go(current - 1); }
    else if (key === 'home' && !reading) { event.preventDefault(); go(1); }
    else if (key === 'end' && !reading) { event.preventDefault(); go(count); }
    else if (key === 'g') { event.preventDefault(); openOverview(); }
    else if (key === 'r') { event.preventDefault(); setReading(!reading); }
    else if (key === 'f') { event.preventDefault(); toggleFullscreen(); }
  });
  document.getElementById('deck').addEventListener('touchstart', event => {
    if (reading || event.touches.length !== 1 || !event.target.closest('.slide-wrap')) { touchStart = null; return; }
    touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  document.getElementById('deck').addEventListener('touchend', event => {
    if (!touchStart || reading) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
  window.addEventListener('hashchange', () => go(hashNumber(), { updateHash: false }));
  window.addEventListener('scroll', () => {
    if (!reading || scrollFrame !== null) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      const marker = Math.min(window.innerHeight * .32, 250);
      let best = 0;
      slides.forEach((slide, i) => { if (slide.getBoundingClientRect().top <= marker) best = i; });
      if (current !== best + 1) {
        current = best + 1;
        updateControls();
        history.replaceState(null, '', `#slide-${current}`);
      }
    });
  }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(document.getElementById('deck'));
  window.addEventListener('resize', resize);
  window.addEventListener('beforeprint', () => slides.forEach(slide => { slide.inert = false; }));
  window.addEventListener('afterprint', () => go(current, { scroll: false }));
  go(hashNumber(), { scroll: false });
  document.fonts.ready.then(resize);
})();
