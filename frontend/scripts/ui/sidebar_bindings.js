window.HaitiMapApp = window.HaitiMapApp || {};

(function registerSidebarBindings(app) {
  function getMarkerAuthFetch() {
    return app.services?.fetchWithMarkerAuth || null;
  }

  function bindMapControls() {
    const opacitySlider = document.getElementById('opacitySlider');
    if (!opacitySlider) return;

    opacitySlider.addEventListener('input', () => {
      app.events.emit('mapOpacityChange', {
        opacity: parseFloat(opacitySlider.value)
      });
    });
  }

  function bindImportControls() {
    const toggleImportMenu = document.getElementById('toggleImportMenu');
    const importMenuSection = document.getElementById('importMenuSection');
    if (!toggleImportMenu || !importMenuSection) return;

    const syncImportMenuVisibility = () => {
      app.state.ui.importMenuVisible = !!toggleImportMenu.checked;
      importMenuSection.hidden = !app.state.ui.importMenuVisible;
    };

    toggleImportMenu.checked = !!app.state.ui.importMenuVisible;
    toggleImportMenu.addEventListener('change', syncImportMenuVisibility);
    syncImportMenuVisibility();
  }

  function bindSidebarToggle() {
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    const controls = document.getElementById('controls');
    if (!toggleBtn || !controls) return;

    const syncSidebarVisibility = () => {
      controls.style.display = app.state.ui.sidebarVisible ? 'flex' : 'none';
      toggleBtn.textContent = app.state.ui.sidebarVisible ? '☰ Hide' : '☰ Show';
    };

    toggleBtn.addEventListener('click', () => {
      app.state.ui.sidebarVisible = !app.state.ui.sidebarVisible;
      syncSidebarVisibility();
    });

    syncSidebarVisibility();
  }

  function bindDataActions() {
    document.getElementById('saveButton')?.addEventListener('click', () => {
      if (typeof app.actions?.saveConflictData === 'function') {
        app.actions.saveConflictData();
        return;
      }
      if (typeof window.saveConflictData === 'function') {
        window.saveConflictData();
        return;
      }

      console.warn('saveConflictData is not available');
    });

    document.getElementById('backupDBBtn')?.addEventListener('click', () => {
      const fetchWithMarkerAuth = getMarkerAuthFetch();
      if (!fetchWithMarkerAuth) {
        alert('❌ Backup thất bại: chưa sẵn sàng xác thực phiên');
        return;
      }

      fetchWithMarkerAuth('/backup_data', {}, { timeoutMs: 30000 })
        .then(response => {
          if (!response.ok) {
            return response.text().then(text => {
              throw new Error(text || 'Backup thất bại');
            });
          }
          const disposition = response.headers.get('Content-Disposition');
          const match = /filename="?(.+)"?/.exec(disposition);
          const filename = match?.[1] || 'backup_data.zip';

          return response.blob().then(blob => ({ blob, filename }));
        })
        .then(({ blob, filename }) => {
          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
        })
        .catch(err => alert(`❌ Backup thất bại: ${err.message}`));
    });
  }

  function bindSidebar() {
    bindMapControls();
    bindImportControls();
    bindSidebarToggle();
    bindDataActions();
  }

  app.ui = app.ui || {};
  app.ui.sidebar = app.ui.sidebar || {};
  app.ui.sidebar.bind = bindSidebar;
})(window.HaitiMapApp);
