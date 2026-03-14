window.HaitiMapApp = window.HaitiMapApp || {};

(function registerSidebarTemplate(app) {
  function buildMapSection() {
    return `
        <div class="control-section">
          <label class="map-checkbox-control" for="toggleLegendBtn">
            <input type="checkbox" id="toggleLegendBtn" checked>
            Hiện chú thích
          </label>
          <div class="file-input-group compact-group">
            <label for="opacitySlider">Độ mờ bản đồ</label>
            <input type="range" id="opacitySlider" min="0" max="1" step="0.05" value="0.6">
          </div>
        </div>
    `;
  }

  function buildSessionSection() {
    return `
        <div class="session-summary">
          <div>
            <div id="currentUsername" class="session-username">Guest</div>
            <div id="currentUserRole" class="session-role">ANONYMOUS</div>
          </div>
          <div class="session-actions">
            <button id="loginBtn" type="button" class="ghost-button">Login</button>
            <button id="logoutBtn" type="button" class="ghost-button" hidden>Logout</button>
          </div>
        </div>
    `;
  }

  function buildLayerSection() {
    return `
        <div class="control-section layer-section">
          <div class="section-header">
            <h3 class="section-title">Name / Icon</h3>
          </div>
          <div id="layerToggles" class="toggle-grid">
            <label class="toggle-row"><input type="checkbox" id="toggleSiteLabel"><input type="checkbox" id="toggleSiteIcon"> <span>Site</span></label>
            <label class="toggle-row"><input type="checkbox" id="togglePoliceLabel"><input type="checkbox" id="togglePoliceIcon" checked> <span>Police</span></label>
            <label class="toggle-row"><input type="checkbox" id="toggleBanditLabel"><input type="checkbox" id="toggleBanditIcon" checked> <span>Bandit</span></label>
            <label class="toggle-row"><input type="checkbox" id="toggleShowroomLabel"><input type="checkbox" id="toggleShowroomIcon" checked> <span>Showroom</span></label>
            <label class="toggle-row"><input type="checkbox" id="toggleHQLabel" checked><input type="checkbox" id="toggleHQIcon" checked> <span>HQ</span></label>
            <label class="toggle-row"><input type="checkbox" id="toggleDrawnItems" checked><input type="checkbox" id="toggleDrawTools" checked data-required-role="editor"> <span>Draw</span></label>
          </div>
        </div>
    `;
  }

  function buildMarkerSection() {
    return `
        <div class="control-section" data-required-role="editor" hidden>
          <div class="section-header">
            <span class="section-eyebrow">Markers</span>
            <h3 class="section-title">Chỉnh sửa đối tượng</h3>
          </div>
          <div id="markerEditorTools" class="button-stack">
            <button id="toggleMarkerEditBtn" type="button">Edit Mode: OFF</button>
            <button id="addPoliceBtn" type="button">+ Add Police</button>
            <button id="addBanditBtn" type="button">+ Add Bandit</button>
            <button id="addShowroomBtn" type="button">+ Add Showroom</button>
            <button id="saveMarkersBtn" type="button">Save Marker to File</button>
          </div>
        </div>
    `;
  }

  function buildImportSection() {
    return `
        <div class="control-section" data-required-role="admin" hidden>
          <div class="section-header">
            <span class="section-eyebrow">Import</span>
            <h3 class="section-title">Nhập dữ liệu</h3>
          </div>
          <label class="toggle-imports-control" for="toggleImportMenu">
            <input type="checkbox" id="toggleImportMenu">
            Menu import
          </label>
          <div id="importMenuSection" class="import-list">
            <div class="file-input-group">
              <label for="conflictInput">Import Conflict</label>
              <input type="file" id="conflictInput" accept=".xlsx" />
            </div>
            <div class="file-input-group">
              <label for="policeInput">Import Police</label>
              <input type="file" id="policeInput" accept=".xlsx" />
            </div>
            <div class="file-input-group">
              <label for="banditInput">Import Bandit</label>
              <input type="file" id="banditInput" accept=".xlsx" />
            </div>
            <div class="file-input-group">
              <label for="showroomInput">Import Showroom</label>
              <input type="file" id="showroomInput" accept=".xlsx" />
            </div>
            <div class="file-input-group">
              <label for="siteInput">Import Site</label>
              <input type="file" id="siteInput" accept=".xlsx" />
            </div>
            <div class="file-input-group">
              <label for="hqInput">Import HQ</label>
              <input type="file" id="hqInput" accept=".xlsx" />
            </div>
          </div>
        </div>
    `;
  }

  function buildDataSection() {
    return `
        <div class="control-section" data-required-role="editor" hidden>
          <div class="section-header">
            <span class="section-eyebrow">Data</span>
            <h3 class="section-title">Thao tác dữ liệu</h3>
          </div>
          <div class="button-stack">
            <button id="saveButton" type="button">Lưu Conflict Data</button>
            <button id="backupDBBtn" type="button" data-required-role="admin" hidden>BackupDB</button>
          </div>
        </div>
    `;
  }

  function buildUserManagementSection() {
    return `
        <div class="control-section" data-required-role="editor" hidden>
          <div class="section-header">
            <span class="section-eyebrow">User</span>
            <h3 class="section-title">Quản lý tài khoản</h3>
          </div>
          <button id="changePasswordBtn" type="button">Đổi mật khẩu</button>
          <button id="createUserModalBtn" type="button" data-required-role="admin" hidden>Tạo user</button>
          <button id="deleteUserModalBtn" type="button" data-required-role="admin" hidden>Xóa user</button>
        </div>
    `;
  }

  function buildSidebarHTML() {
    return `
      <div id="controls">
        <div class="controls-header">
          <p class="controls-kicker">HAITI CONFLICT MAP</p>
          ${buildSessionSection()}
        </div>
        ${buildMapSection()}
        ${buildLayerSection()}
        ${buildMarkerSection()}
        ${buildImportSection()}
        ${buildDataSection()}
        ${buildUserManagementSection()}
      </div>
      <button id="toggleSidebarBtn">☰ Hide Panel</button>
    `;
  }

  function renderSidebar() {
    const appRoot = document.getElementById('app');
    if (!appRoot) {
      console.warn('#app is not available');
      return;
    }

    if (document.getElementById('controls') || document.getElementById('toggleSidebarBtn')) {
      console.warn('Sidebar is already rendered');
      return;
    }

    appRoot.insertAdjacentHTML('afterbegin', buildSidebarHTML());
    app.events.emit('menuPanelReady');
  }

  app.ui = app.ui || {};
  app.ui.sidebar = app.ui.sidebar || {};
  app.ui.sidebar.buildHTML = buildSidebarHTML;
  app.ui.sidebar.render = renderSidebar;
})(window.HaitiMapApp);
