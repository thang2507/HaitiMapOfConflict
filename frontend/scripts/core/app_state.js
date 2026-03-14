window.HaitiMapApp = window.HaitiMapApp || {};

(function initializeAppState(app) {
  app.state = app.state || {
    conflictLayer: null,
    conflictDataVersion: 'missing',
    markerDataVersions: {},
    auth: {
      isAuthenticated: false,
      user: null,
      role: 'guest',
    },
    ui: {
      sidebarVisible: true,
      importMenuVisible: false,
      legendVisible: true
    }
  };

  app.services = app.services || {};
  app.actions = app.actions || {};
  app.ui = app.ui || {};
})(window.HaitiMapApp);
