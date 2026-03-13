
document.addEventListener('DOMContentLoaded', () => {
  const menuHTML = `
    <div id="controls">
      <h2>Conflict Map</h2>
      <button id="toggleLegendBtn">Ẩn/Hiện chú thích</button>
      <button id="saveButton" onclick="saveConflictData()">Lưu Conflict Data</button>
      <div id="markerEditorTools" style="background: white; padding: 10px; margin-top: 5px;">
        <label>Marker Editor</label><br>
        <button id="toggleMarkerEditBtn" type="button">Edit Mode: OFF</button>
        <button id="addPoliceBtn" type="button">+ Add Police</button>
        <button id="addBanditBtn" type="button">+ Add Bandit</button>
        <button id="addShowroomBtn" type="button">+ Add Showroom</button>
        <button id="saveMarkersBtn" type="button">Save Marker to File</button>
      </div>
      <div id="layerToggles" style="background: white; padding: 10px;">
        <label>Name/Icon</label><br>
        <label><input type="checkbox" id="toggleSiteLabel"> 
          <input type="checkbox" id="toggleSiteIcon">Site</label><br>
        <label><input type="checkbox" id="togglePoliceLabel"> 
          <input type="checkbox" id="togglePoliceIcon" checked>Police</label><br>
        <label><input type="checkbox" id="toggleBanditLabel">
          <input type="checkbox" id="toggleBanditIcon" checked>Bandit</label><br>
        <label><input type="checkbox" id="toggleShowroomLabel">
          <input type="checkbox" id="toggleShowroomIcon" checked>Showroom</label><br>
        <label><input type="checkbox" id="toggleHQLabel" checked>
          <input type="checkbox" id="toggleHQIcon" checked>HQ</label><br>
        <label>
          <input type="checkbox" id="toggleDrawnItems" checked>
          <input type="checkbox" id="toggleDrawTools" checked>Draw
        </label>

      </div>
      <div class="file-input-group">
        <label for="opacitySlider">Độ mờ bản đồ</label>
        <input type="range" id="opacitySlider" min="0" max="1" step="0.05" value="0.6">
      </div>
      <label class="toggle-imports-control" for="toggleImportMenu">
        <input type="checkbox" id="toggleImportMenu">
        Hiện menu import
      </label>
      <div id="importMenuSection">
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
      <button id="backupDBBtn">BackupDB</button>
    </div>
    <button id="toggleSidebarBtn">☰ Hide Panel</button>
  `;
  document.getElementById('app').insertAdjacentHTML('afterbegin', menuHTML);

  const opacitySlider = document.getElementById('opacitySlider');
  if (opacitySlider) {
    opacitySlider.addEventListener('input', () => {
      const newOpacity = parseFloat(opacitySlider.value);
      if (typeof conflictLayer !== 'undefined') {
        conflictLayer.setStyle({ fillOpacity: newOpacity });
      }
    });
  }

  const toggleImportMenu = document.getElementById('toggleImportMenu');
  const importMenuSection = document.getElementById('importMenuSection');
  if (toggleImportMenu && importMenuSection) {
    const syncImportMenuVisibility = () => {
      importMenuSection.hidden = !toggleImportMenu.checked;
    };
    toggleImportMenu.addEventListener('change', syncImportMenuVisibility);
    syncImportMenuVisibility();
  }


  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const controls = document.getElementById('controls');
  let sidebarVisible = true;
  toggleBtn.addEventListener('click', () => {
    sidebarVisible = !sidebarVisible;
    controls.style.display = sidebarVisible ? 'flex' : 'none';
    toggleBtn.textContent = sidebarVisible ? '☰ Hide' : '☰ Show';
  });

  document.getElementById('toggleSidebarBtn').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('hidden');
  });
  // Gán sự kiện cho nút Ẩn/Hiện chú thích sau khi DOM sẵn sàng
  document.getElementById('toggleLegendBtn')?.addEventListener('click', () => {
    const checkbox = document.getElementById('toggleLegendBtn');
    if (!checkbox) {
      console.warn("⚠️ Không tìm thấy checkbox #toggleLegendBtn");
      return;
    }
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change'));
  });


  document.getElementById('backupDBBtn')?.addEventListener('click', () => {
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
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(err => alert("❌ Backup thất bại: " + err.message));
  });
  

});
