
    // Upload Site/Police/Bandit/HQ/Showroom
    function handleJsonUpload(inputId, endpoint) {
        document.getElementById(inputId).addEventListener('change', function (event) {
          const file = event.target.files[0];
          if (!file) return;
      
          const password = prompt("Nhập mật khẩu để tải lên:");
          if (password !== '2707') {
            alert("❌ Sai mật khẩu!");
            return;
          }
      
          const formData = new FormData();
          formData.append('file', file);
      
          fetch(endpoint, {
            method: 'POST',
            body: formData
          })
            .then(res => {
              if (res.ok) alert(`✅ Đã lưu ${inputId}`);
              else alert(`❌ Lỗi khi lưu ${inputId}`);
            })
            .catch(err => console.error(err));
        });
      }
 