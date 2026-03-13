var haitiMapApp = window.HaitiMapApp || (window.HaitiMapApp = {});

// Lưu trạng thái Conflict Level
function saveConflictData() {
  const updatedData = [];
  const layer = haitiMapApp.state?.conflictLayer || window.conflictLayer || null;
  if (!layer) return;

  layer.eachLayer(featureLayer => {
    const props = featureLayer.feature.properties;
    updatedData.push({
      name: props.ADM3_EN,
      conflict_level: props.conflict_level
    });
  });

  fetchWithMarkerAuth('/save_conflict_data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Data-Version': window.conflictDataVersion || 'missing'
    },
    body: JSON.stringify(updatedData)
  })
    .then(res => {
      if (res.ok) {
        return res.json().then(result => {
          window.conflictDataVersion = result.version || res.headers.get('X-Data-Version') || 'missing';
          alert('✅ Dữ liệu đã được lưu!');
        });
      } else if (res.status === 409) {
        return res.json().then(conflict => {
          window.conflictDataVersion = conflict.current_version || 'missing';
          throw new Error('Dữ liệu conflict đã bị người khác thay đổi. App sẽ tải lại.');
        });
      } else {
        return res.text().then(text => {
          throw new Error(text || 'Lỗi khi lưu!');
        });
      }
    })
    .catch(err => {
      if (err.message.includes('App sẽ tải lại') && typeof haitiMapApp.actions?.loadConflictMap === 'function') {
        haitiMapApp.actions.loadConflictMap();
      }
      alert(`❌ ${err.message}`);
    });
}

haitiMapApp.actions = haitiMapApp.actions || {};
haitiMapApp.actions.saveConflictData = saveConflictData;
window.saveConflictData = saveConflictData;
