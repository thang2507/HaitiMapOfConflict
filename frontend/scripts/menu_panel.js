document.addEventListener('DOMContentLoaded', () => {
  const app = window.HaitiMapApp;
  if (!app?.ui?.sidebar) {
    console.warn('Sidebar modules are not available');
    return;
  }

  app.ui.sidebar.render();
  app.ui.sidebar.bind();
});
