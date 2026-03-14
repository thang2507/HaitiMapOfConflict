
// Upload Conflict Template (xlsx)
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('conflictInput');
  if (!input) return;

  input.addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    fetchWithMarkerAuth('/upload_conflict', {
      method: 'POST',
      body: formData
    })
      .then(res => {
        if (res.ok) {
          alert('✅ Đã lưu trạng thái lên Server!');
          loadConflictMap();
        } else if (res.status === 403) {
          throw new Error('Bạn không có quyền import conflict');
        } else {
          return res.text().then(text => {
            throw new Error(text || 'Lỗi khi lưu Conflict Template!');
          });
        }
      })
      .catch(err => alert(`❌ ${err.message}`))
      .finally(() => {
        input.value = '';
      });
  });
});
