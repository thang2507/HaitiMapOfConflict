
// Upload Conflict Template (xlsx)
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('conflictInput');
  if (!input) return;

  input.addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const password = prompt("Nhập mật khẩu để tải lên:");
    if (password !== '2707') {
      alert("❌ Sai mật khẩu!");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    fetch('/upload_conflict', {
      method: 'POST',
      body: formData
    })
      .then(res => {
        if (res.ok) {
          alert('✅ Đã lưu trạng thái lên Server!');
          loadConflictMap();
        } else {
          alert('❌ Lỗi khi lưu Conflict Template!');
        }
      })
      .catch(err => console.error(err));
  });
});
