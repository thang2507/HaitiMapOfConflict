// Thêm chú thích (legend) vào bản đồ
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function (map) {
  const div = L.DomUtil.create('div', 'info legend');
  div.innerHTML = `
    <div><i style="background: #2ecc71; width: 18px; height: 18px; display: inline-block; margin-right: 8px;"></i> An toàn</div>
    <div><i style="background: #f1c40f; width: 18px; height: 18px; display: inline-block; margin-right: 8px;"></i> Đang giao tranh</div>
    <div><i style="background: #e74c3c; width: 18px; height: 18px; display: inline-block; margin-right: 8px;"></i> Băng đảng chiếm</div>
    <div><img src="/frontend/images/hq_logo.png" style="width: 18px; height: 18px; margin-right: 8px;" />Trụ sở Chi nhánh</div>
    <div><img src="/frontend/images/pnh_logo.png" style="width: 18px; height: 18px; margin-right: 8px;" />Vị trí cảnh sát</div>
    <div><img src="/frontend/images/bandit_logo.png" style="width: 18px; height: 18px; margin-right: 8px;" />Vị trí băng đảng</div>
        <div><img src="/frontend/images/showroom_logo.png" style="width: 18px; height: 18px; margin-right: 8px;" />Vị trí showroom</div>
        <div>
      <svg width="18" height="18" style="margin-right: 8px;">
        <circle cx="9" cy="9" r="5" fill="#ff0000" stroke="#ff0000" stroke-width="1"></circle>
      </svg>
      MainNode
    </div>
    <div>
      <svg width="18" height="18" style="margin-right: 8px;">
        <circle cx="9" cy="9" r="5" fill="#0000FF" stroke="#0000FF" stroke-width="1"></circle>
      </svg>
      HubVibaBackbone
    </div>
    <div>
      <svg width="18" height="18" style="margin-right: 8px;">
        <circle cx="9" cy="9" r="5" fill="#800000" stroke="#800000" stroke-width="1"></circle>
      </svg>
      Trạm Access
    </div>
  `;
  return div;
};

legend.addTo(map);

// Thêm chức năng Ẩn/Hiện Chú thích
document.addEventListener('DOMContentLoaded', () => {
  const toggleLegendBtn = document.getElementById('toggleLegendBtn');
  const legendElement = document.querySelector('.info.legend');

  if (toggleLegendBtn && legendElement) {
    toggleLegendBtn.addEventListener('click', () => {
      const isHidden = getComputedStyle(legendElement).display === 'none';
      if (isHidden) {
        legendElement.style.display = 'block';
        toggleLegendBtn.textContent = 'Ẩn Chú Thích';
      } else {
        legendElement.style.display = 'none';
        toggleLegendBtn.textContent = 'Hiện Chú Thích';
      }
    });
  }
});
