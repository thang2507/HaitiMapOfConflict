var haitiMapApp = window.HaitiMapApp || (window.HaitiMapApp = {});

// Thêm chú thích (legend) vào bản đồ
const legend = L.control({ position: 'bottomleft' });

legend.onAdd = function (map) {
  const div = L.DomUtil.create('div', 'info legend');
  div.innerHTML = `
    <div class="legend-item"><span class="legend-swatch legend-safe"></span><span>An toàn</span></div>
    <div class="legend-item"><span class="legend-swatch legend-conflict"></span><span>Đang giao tranh</span></div>
    <div class="legend-item"><span class="legend-swatch legend-bandit-zone"></span><span>Băng đảng chiếm</span></div>
    <div class="legend-item"><img src="/frontend/images/hq_logo.png" class="legend-image-icon" alt="HQ" /><span>Trụ sở Chi nhánh</span></div>
    <div class="legend-item"><img src="/frontend/images/pnh_logo.png" class="legend-image-icon" alt="Police" /><span>Vị trí cảnh sát</span></div>
    <div class="legend-item"><img src="/frontend/images/bandit_logo.png" class="legend-image-icon" alt="Bandit" /><span>Vị trí băng đảng</span></div>
    <div class="legend-item"><img src="/frontend/images/showroom_logo.png" class="legend-image-icon" alt="Showroom" /><span>Vị trí showroom</span></div>
    <div class="legend-item"><span class="legend-node legend-main-node"></span><span>MainNode</span></div>
    <div class="legend-item"><span class="legend-node legend-backbone-node"></span><span>HubVibaBackbone</span></div>
    <div class="legend-item"><span class="legend-node legend-access-node"></span><span>Trạm Access</span></div>
  `;
  return div;
};

legend.addTo(map);

function bindLegendToggle() {
  const toggleLegendBtn = document.getElementById('toggleLegendBtn');
  const legendElement = document.querySelector('.info.legend');

  if (!toggleLegendBtn || !legendElement) {
    window.setTimeout(bindLegendToggle, 50);
    return;
  }

  if (toggleLegendBtn.dataset.bound === 'true') {
    legendElement.style.display = toggleLegendBtn.checked ? 'block' : 'none';
    return;
  }

  const syncLegendVisibility = () => {
    const visible = !!toggleLegendBtn.checked;
    if (haitiMapApp.state?.ui) {
      haitiMapApp.state.ui.legendVisible = visible;
    }
    legendElement.style.display = visible ? 'block' : 'none';
  };

  toggleLegendBtn.checked = haitiMapApp.state?.ui?.legendVisible ?? true;
  toggleLegendBtn.addEventListener('change', syncLegendVisibility);
  toggleLegendBtn.dataset.bound = 'true';
  syncLegendVisibility();
}

// Thêm chức năng Ẩn/Hiện Chú thích sau khi sidebar được render
document.addEventListener('DOMContentLoaded', bindLegendToggle);
haitiMapApp.events.on('menuPanelReady', bindLegendToggle);
