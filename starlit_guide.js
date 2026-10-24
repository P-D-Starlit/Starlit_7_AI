(() => {
  const links = [...document.querySelectorAll('.topic-link')];
  const panels = [...document.querySelectorAll('.guide-panel')];
  const menu = document.querySelector('.guide-topics');
  if (!menu || !panels.length) return;

  // Keep each topic addressable by URL and restore it with browser Back/Forward.
  function selectTopic() {
    const selected = panels.find(panel => `#${panel.id}` === location.hash) || panels[0];
    for (const panel of panels) panel.hidden = panel !== selected;
    for (const link of links) {
      const active = link.hash === `#${selected.id}`;
      link.setAttribute('aria-selected', String(active));
      link.tabIndex = active ? 0 : -1;
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  }

  // Without JavaScript the links still navigate to all readable sections.
  menu.setAttribute('role', 'tablist');
  links.forEach((link, index) => {
    link.setAttribute('role', 'tab');
    link.setAttribute('aria-controls', panels[index].id);
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].setAttribute('aria-labelledby', link.id);
    panels[index].tabIndex = 0;
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (location.hash !== link.hash) history.pushState(null, '', link.hash);
      selectTopic();
    });
    link.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % links.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + links.length) % links.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = links.length - 1;
      else if (event.key === ' ') {
        event.preventDefault();
        link.click();
        return;
      } else return;
      event.preventDefault();
      links[next].focus();
      links[next].click();
    });
  });
  window.addEventListener('hashchange', selectTopic);
  window.addEventListener('popstate', selectTopic);
  selectTopic();
})();
