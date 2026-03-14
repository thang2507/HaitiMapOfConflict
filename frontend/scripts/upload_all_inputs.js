
document.addEventListener('DOMContentLoaded', () => {
  const inputs = [
    { id: 'siteInput', endpoint: '/upload_site' },
    { id: 'policeInput', endpoint: '/upload_police' },
    { id: 'banditInput', endpoint: '/upload_bandit' },
    { id: 'showroomInput', endpoint: '/upload_showroom' },
    { id: 'hqInput', endpoint: '/upload_hq' }
  ];

  inputs.forEach(({ id, endpoint }) => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener('change', function (event) {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      fetchWithMarkerAuth(endpoint, {
        method: 'POST',
        body: formData
      })
        .then(res => {
          if (res.ok) {
            alert(`✅ Đã lưu ${id}`);
          } else if (res.status === 403) {
            throw new Error('Bạn không có quyền import dữ liệu');
          } else {
            return res.text().then(text => {
              throw new Error(text || `Lỗi khi lưu ${id}`);
            });
          }
        })
        .catch(err => alert(`❌ ${err.message}`))
        .finally(() => {
          input.value = '';
        });
    });
  });
});
