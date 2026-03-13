window.HaitiMapApp = window.HaitiMapApp || {};

(function initializeEventBus(app) {
  if (app.events) {
    return;
  }

  const target = new EventTarget();

  app.events = {
    emit(name, detail = {}) {
      const event = new CustomEvent(name, { detail });
      target.dispatchEvent(event);
      document.dispatchEvent(new CustomEvent(name, { detail }));
    },
    on(name, handler) {
      target.addEventListener(name, handler);
      return () => target.removeEventListener(name, handler);
    }
  };
})(window.HaitiMapApp);
