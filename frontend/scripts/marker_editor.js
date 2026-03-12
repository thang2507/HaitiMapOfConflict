document.addEventListener('DOMContentLoaded', () => {
  const MARKER_CONFIG = {
    police: {
      label: 'Police',
      iconUrl: '/frontend/images/pnh_logo.png',
      iconSize: [16, 16],
      iconAnchor: [6, 16],
      popupAnchor: [0, -16],
      labelColor: '#800000',
      nameField: 'PoliceName',
      iconToggleId: 'togglePoliceIcon',
      labelToggleId: 'togglePoliceLabel'
    },
    bandit: {
      label: 'Bandit',
      iconUrl: '/frontend/images/bandit_logo.png',
      iconSize: [16, 16],
      iconAnchor: [8, 16],
      popupAnchor: [0, -16],
      labelColor: '#000000',
      nameField: 'BanditName',
      iconToggleId: 'toggleBanditIcon',
      labelToggleId: 'toggleBanditLabel'
    },
    showroom: {
      label: 'Showroom',
      iconUrl: '/frontend/images/showroom_logo.png',
      iconSize: [16, 16],
      iconAnchor: [8, 16],
      popupAnchor: [0, -16],
      labelColor: '#f1c40f',
      nameField: 'ShowroomName',
      iconToggleId: 'toggleShowroomIcon',
      labelToggleId: 'toggleShowroomLabel'
    }
  };

  const markerTypes = Object.keys(MARKER_CONFIG);
  const pendingLoads = new Set(markerTypes);
  const markerState = Object.fromEntries(
    markerTypes.map(type => {
      window[`${type}Icons`] = window[`${type}Icons`] || [];
      window[`${type}Labels`] = window[`${type}Labels`] || [];
      return [type, { icons: window[`${type}Icons`], labels: window[`${type}Labels`] }];
    })
  );

  let addMode = null;
  let editMode = false;
  let dirty = false;
  let isSaving = false;
  let savedSnapshot = {};
  let autosaveFailures = 0;
  const dirtyTypes = new Set();

  const history = [];
  const redoStack = [];
  const HISTORY_LIMIT = 50;

  const addButtons = Object.fromEntries(
    markerTypes.map(type => [type, document.getElementById(`add${MARKER_CONFIG[type].label}Btn`)])
  );
  const toggleEditBtn = document.getElementById('toggleMarkerEditBtn');
  const saveBtn = document.getElementById('saveMarkersBtn');
  const markerTools = document.getElementById('markerEditorTools');

  if (markerTools) {
    saveBtn?.insertAdjacentHTML('beforebegin', `
      <button id="undoMarkerBtn" type="button">Undo</button>
      <button id="redoMarkerBtn" type="button">Redo</button>
      <small id="markerDirtyState" style="display:block;margin-top:6px;color:#666;">No changes</small>
    `);
  }

  const undoBtn = document.getElementById('undoMarkerBtn');
  const redoBtn = document.getElementById('redoMarkerBtn');
  const dirtyLabel = document.getElementById('markerDirtyState');
  window.markerDataVersions = window.markerDataVersions || {};

  function getMarkerKeyHeader() {
    const key = sessionStorage.getItem('marker_api_key') || '';
    return key ? { 'X-Marker-Key': key } : {};
  }

  function setDirty(value) {
    dirty = value;
    if (dirtyLabel) {
      dirtyLabel.textContent = dirty ? 'Unsaved changes' : 'No changes';
      dirtyLabel.style.color = dirty ? '#b71c1c' : '#666';
      dirtyLabel.style.fontWeight = dirty ? '700' : '400';
    }
    if (!value) dirtyTypes.clear();
  }

  function markTypeDirty(markerType) {
    dirtyTypes.add(markerType);
    setDirty(true);
  }

  function updateUndoRedoUI() {
    if (undoBtn) undoBtn.disabled = history.length <= 1;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }

  function getConfig(markerType) {
    return MARKER_CONFIG[markerType];
  }

  function getState(markerType) {
    return markerState[markerType];
  }

  function syncAddButtons() {
    markerTypes.forEach(type => {
      if (!addButtons[type]) return;
      addButtons[type].dataset.active = addMode === type ? 'true' : 'false';
    });
  }

  function buildIcon(markerType) {
    const config = getConfig(markerType);
    return L.icon({
      iconUrl: config.iconUrl,
      iconSize: config.iconSize,
      iconAnchor: config.iconAnchor,
      popupAnchor: config.popupAnchor
    });
  }

  function buildLabel(markerType, text) {
    const config = getConfig(markerType);
    return L.divIcon({
      className: `${markerType}-label`,
      html: `<div style="text-align:center;font-size:8px;font-weight:bold;color:${config.labelColor};white-space:nowrap;">${text}</div>`,
      iconSize: [16, 16],
      iconAnchor: [-10, 16]
    });
  }

  function makeDraggable(marker, enabled) {
    if (!marker.dragging) return;
    if (enabled) marker.dragging.enable();
    else marker.dragging.disable();
  }

  function enableEditMode(enabled) {
    editMode = enabled;
    markerTypes.forEach(markerType => {
      getState(markerType).icons.forEach(marker => makeDraggable(marker, editMode));
    });
    if (toggleEditBtn) {
      toggleEditBtn.textContent = `Edit Mode: ${editMode ? 'ON' : 'OFF'}`;
      toggleEditBtn.dataset.editMode = editMode ? 'on' : 'off';
    }
  }

  function markerToSnapshot(marker, markerType) {
    const point = marker.getLatLng();
    return {
      markerType,
      name: marker._markerName || '',
      lat: point.lat,
      lng: point.lng
    };
  }

  function getStateSnapshot() {
    return Object.fromEntries(
      markerTypes.map(markerType => [
        markerType,
        getState(markerType).icons.map(marker => markerToSnapshot(marker, markerType))
      ])
    );
  }

  function cloneSnapshot(snapshot) {
    return JSON.parse(JSON.stringify(snapshot || {}));
  }

  function recordSignature(record) {
    return `${record.name}__${record.lat}__${record.lng}`;
  }

  function recordCoordinateKey(record) {
    return `${record.lat}__${record.lng}`;
  }

  function getChangedMarkerNames(markerTypesToCheck) {
    const currentSnapshot = getStateSnapshot();
    const changedNames = new Set();

    markerTypesToCheck.forEach(markerType => {
      const previousRecords = savedSnapshot[markerType] || [];
      const currentRecords = currentSnapshot[markerType] || [];
      const previousSignatures = new Set(previousRecords.map(recordSignature));
      const currentSignatures = new Set(currentRecords.map(recordSignature));
      const currentByCoordinates = new Map(
        currentRecords.map(record => [recordCoordinateKey(record), record])
      );

      currentRecords.forEach(record => {
        if (!previousSignatures.has(recordSignature(record))) {
          changedNames.add(record.name);
        }
      });

      previousRecords.forEach(record => {
        if (currentSignatures.has(recordSignature(record))) return;
        const renamedRecord = currentByCoordinates.get(recordCoordinateKey(record));
        changedNames.add(renamedRecord ? renamedRecord.name : record.name);
      });
    });

    return Array.from(changedNames).filter(Boolean);
  }

  function clearLayer(markerType) {
    const state = getState(markerType);
    state.icons.forEach(marker => map.removeLayer(marker));
    state.labels.forEach(marker => map.removeLayer(marker));
    state.icons.length = 0;
    state.labels.length = 0;
  }

  function isLabelVisible(markerType) {
    const toggle = document.getElementById(getConfig(markerType).labelToggleId);
    return !!toggle?.checked;
  }

  function isIconVisible(markerType) {
    const toggle = document.getElementById(getConfig(markerType).iconToggleId);
    return toggle ? !!toggle.checked : true;
  }

  function syncMarkerVisibility(markerType) {
    const state = getState(markerType);

    state.icons.forEach(marker => {
      if (isIconVisible(markerType)) map.addLayer(marker);
      else map.removeLayer(marker);
    });

    state.labels.forEach(marker => {
      if (isLabelVisible(markerType)) map.addLayer(marker);
      else map.removeLayer(marker);
    });
  }

  window.syncOperationalMarkerVisibility = syncMarkerVisibility;

  function registerMarker(marker, markerType) {
    const state = getState(markerType);

    if (!marker._labelMarker) {
      const labelMarker = L.marker(marker.getLatLng(), {
        icon: buildLabel(markerType, marker._markerName || '')
      });
      marker._labelMarker = labelMarker;
    }

    if (marker._labelMarker && !state.labels.includes(marker._labelMarker)) {
      state.labels.push(marker._labelMarker);
    }

    if (!marker._opsBound) {
      marker.on('drag', () => {
        if (marker._labelMarker) marker._labelMarker.setLatLng(marker.getLatLng());
      });

      marker.on('dragend', () => {
        pushHistory();
        markTypeDirty(markerType);
      });

      marker.on('contextmenu', () => {
        if (!editMode) return;
        showMarkerModal({
          mode: 'edit',
          markerType,
          initialName: marker._markerName || '',
          onSave: nextName => {
            marker._markerName = nextName;
            marker.bindPopup(`<strong>${nextName}</strong>`);
            if (marker._labelMarker) marker._labelMarker.setIcon(buildLabel(markerType, nextName));
            pushHistory();
            markTypeDirty(markerType);
          },
          onDelete: () => {
            map.removeLayer(marker);
            if (marker._labelMarker) map.removeLayer(marker._labelMarker);
            const iconIndex = state.icons.indexOf(marker);
            if (iconIndex >= 0) state.icons.splice(iconIndex, 1);
            const labelIndex = state.labels.indexOf(marker._labelMarker);
            if (labelIndex >= 0) state.labels.splice(labelIndex, 1);
            pushHistory();
            markTypeDirty(markerType);
          }
        });
      });

      marker._opsBound = true;
    }

    if (!state.icons.includes(marker)) {
      state.icons.push(marker);
    }
    makeDraggable(marker, editMode);
    syncMarkerVisibility(markerType);
  }

  function buildMarkerFromRecord(record) {
    const marker = L.marker([record.lat, record.lng], {
      icon: buildIcon(record.markerType),
      draggable: editMode
    }).bindPopup(`<strong>${record.name}</strong>`).addTo(map);

    marker._markerType = record.markerType;
    marker._markerName = record.name;

    registerMarker(marker, record.markerType);
  }

  function applySnapshot(snapshot, markDirty = true) {
    markerTypes.forEach(clearLayer);
    markerTypes.forEach(markerType => {
      (snapshot[markerType] || []).forEach(record => buildMarkerFromRecord({ ...record, markerType }));
    });

    if (markDirty) setDirty(true);
    enableEditMode(editMode);
    updateUndoRedoUI();
  }

  function pushHistory() {
    history.push(getStateSnapshot());
    if (history.length > HISTORY_LIMIT) history.shift();
    redoStack.length = 0;
    updateUndoRedoUI();
  }

  function undo() {
    if (history.length <= 1) return;
    redoStack.push(history.pop());
    applySnapshot(history[history.length - 1], true);
    updateUndoRedoUI();
  }

  function redo() {
    if (!redoStack.length) return;
    const snapshot = redoStack.pop();
    history.push(snapshot);
    applySnapshot(snapshot, true);
    updateUndoRedoUI();
  }

  function showMarkerModal({ mode = 'create', markerType, initialName = '', onSave, onDelete }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'marker-modal-backdrop';

    wrapper.innerHTML = `
      <div class="marker-modal">
        <h3>${mode === 'create' ? 'Create' : 'Edit'} ${getConfig(markerType).label} Marker</h3>
        <label>Name</label>
        <input id="markerNameInput" type="text" value="${initialName.replace(/"/g, '&quot;')}" />
        <div class="marker-modal-actions">
          ${mode === 'edit' ? '<button id="markerDeleteBtn" class="danger">Delete</button>' : ''}
          <button id="markerCancelBtn">Cancel</button>
          <button id="markerSaveBtn" class="success">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);

    const input = wrapper.querySelector('#markerNameInput');
    const btnCancel = wrapper.querySelector('#markerCancelBtn');
    const btnSave = wrapper.querySelector('#markerSaveBtn');
    const btnDelete = wrapper.querySelector('#markerDeleteBtn');

    if (input) input.focus();

    const close = () => {
      if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
    };

    btnCancel?.addEventListener('click', close);
    btnSave?.addEventListener('click', () => {
      const name = (input?.value || '').trim();
      if (!name) {
        alert('Tên không được để trống');
        return;
      }
      onSave?.(name);
      close();
    });

    btnDelete?.addEventListener('click', () => {
      if (confirm('Xóa marker này?')) {
        onDelete?.();
        close();
      }
    });

    wrapper.addEventListener('click', event => {
      if (event.target === wrapper) close();
    });
  }

  function createMarker(markerType, latlng) {
    const nextIndex = getState(markerType).icons.length + 1;
    showMarkerModal({
      mode: 'create',
      markerType,
      initialName: `${markerType}_${nextIndex}`,
      onSave: name => {
        const marker = L.marker(latlng, {
          icon: buildIcon(markerType),
          draggable: editMode
        }).bindPopup(`<strong>${name}</strong>`).addTo(map);

        marker._markerType = markerType;
        marker._markerName = name;

        registerMarker(marker, markerType);
        pushHistory();
        markTypeDirty(markerType);
        addMode = null;
        syncAddButtons();
      }
    });
  }

  function normalizeExistingMarkers(markerType) {
    const state = getState(markerType);
    state.labels.forEach(marker => map.removeLayer(marker));
    state.labels.length = 0;

    state.icons.forEach(marker => {
      if (marker._labelMarker) {
        map.removeLayer(marker._labelMarker);
      }
      const guessed = marker.getPopup()?.getContent()?.replace(/<[^>]+>/g, '').trim() || getConfig(markerType).label;
      marker._markerType = markerType;
      marker._markerName = marker._markerName || guessed;
      registerMarker(marker, markerType);
    });
  }

  async function saveType(markerType) {
    const config = getConfig(markerType);
    const payload = {
      type: 'FeatureCollection',
      features: getState(markerType).icons.map(marker => {
        const point = marker.getLatLng();
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
          properties: { [config.nameField]: marker._markerName || '' }
        };
      })
    };

    const response = await fetchWithTimeout(`/save_markers?type=${markerType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Data-Version': window.markerDataVersions[markerType] || 'missing',
        ...getMarkerKeyHeader()
      },
      body: JSON.stringify(payload)
    }, 10000);

    if (response.status === 401) {
      const key = prompt('Nhập Marker API Key:');
      if (key && key.trim()) {
        sessionStorage.setItem('marker_api_key', key.trim());
        return saveType(markerType);
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      if (response.status === 409) {
        const conflict = await response.json();
        if (conflict.current_version) {
          window.markerDataVersions[markerType] = conflict.current_version;
        }
        throw new Error(`[${markerType}] ${conflict.message}`);
      }
      const text = await response.text();
      throw new Error(`[${markerType}] ${text || `Save ${markerType} failed`}`);
    }

    const result = await response.json();
    window.markerDataVersions[markerType] = result.version || response.headers.get('X-Data-Version') || 'missing';
  }

  async function saveAll() {
    if (isSaving) return;
    isSaving = true;
    try {
      const typesToSave = dirtyTypes.size ? Array.from(dirtyTypes) : [];
      if (!typesToSave.length) {
        alert('✅ Không có thay đổi marker để lưu');
        return;
      }

      const changedMarkerNames = getChangedMarkerNames(typesToSave);
      for (const markerType of typesToSave) {
        await saveType(markerType);
      }
      autosaveFailures = 0;
      savedSnapshot = cloneSnapshot(getStateSnapshot());
      setDirty(false);
      const successLabel = changedMarkerNames.length
        ? changedMarkerNames.join(', ')
        : typesToSave.join(', ');
      alert(`✅ Đã lưu marker: ${successLabel}`);
    } catch (error) {
      autosaveFailures += 1;
      console.error(error);
      alert(`❌ Lưu marker thất bại: ${error.message}`);
    } finally {
      isSaving = false;
    }
  }

  window.registerOperationalMarker = function registerOperationalMarker(marker, markerType) {
    if (!marker || !getConfig(markerType)) return;
    marker._markerType = markerType;
    marker._markerName = marker._markerName || marker.getPopup()?.getContent()?.replace(/<[^>]+>/g, '').trim() || getConfig(markerType).label;
    registerMarker(marker, markerType);
  };

  markerTypes.forEach(markerType => {
    const button = addButtons[markerType];
    document.getElementById(getConfig(markerType).iconToggleId)?.addEventListener('change', () => {
      syncMarkerVisibility(markerType);
    });
    document.getElementById(getConfig(markerType).labelToggleId)?.addEventListener('change', () => {
      syncMarkerVisibility(markerType);
    });

    if (!button) return;
    button.addEventListener('click', () => {
      if (!editMode) return;
      addMode = addMode === markerType ? null : markerType;
      syncAddButtons();
    });
  });

  if (toggleEditBtn) {
    toggleEditBtn.addEventListener('click', () => {
      enableEditMode(!editMode);
      if (!editMode) {
        addMode = null;
        syncAddButtons();
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', saveAll);
  }

  if (undoBtn) undoBtn.addEventListener('click', undo);
  if (redoBtn) redoBtn.addEventListener('click', redo);

  document.addEventListener('operationalMarkersLoaded', event => {
    const markerType = event.detail?.markerType;
    if (!markerType || !pendingLoads.has(markerType)) return;

    normalizeExistingMarkers(markerType);
    syncMarkerVisibility(markerType);
    pendingLoads.delete(markerType);

    if (pendingLoads.size === 0) {
      pushHistory();
      savedSnapshot = cloneSnapshot(getStateSnapshot());
      setDirty(false);
      updateUndoRedoUI();
    }
  });

  map.on('click', event => {
    if (!editMode || !addMode) return;
    createMarker(addMode, event.latlng);
  });

  setInterval(() => {
    if (dirty && !isSaving && autosaveFailures < 3) saveAll();
  }, 5000);

  enableEditMode(false);
  updateUndoRedoUI();
});
