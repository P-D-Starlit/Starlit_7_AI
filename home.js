(() => {
  'use strict';
  const cover = document.querySelector('.cover-mount .slide-wrap');
  if (!cover) return;
  const resizeCover = () => {
    cover.style.setProperty('--slide-scale', cover.clientWidth / 1279.968);
  };
  if ('ResizeObserver' in window) new ResizeObserver(resizeCover).observe(cover);
  window.addEventListener('resize', resizeCover);
  resizeCover();
})();
