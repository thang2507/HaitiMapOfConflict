
// Lưu trạng thái Conflict Level
function saveConflictData() {
  const updatedData = [];
  if (!conflictLayer) return;

  conflictLayer.eachLayer(layer => {
    const props = layer.feature.properties;
    updatedData.push({
      name: props.ADM3_EN,
      conflict_level: props.conflict_level
    });
  });

  fetch('/save_conflict_data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedData)
  })
    .then(res => {
      if (res.ok) alert('✅ Dữ liệu đã được lưu!');
      else alert('❌ Lỗi khi lưu!');
    })
    .catch(err => console.error(err));
}
