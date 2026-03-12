
document.addEventListener('DOMContentLoaded', () => {
  // Hiển thị site từ SitePosition.json với icon và tên riêng biệt
  let siteIconMarkers = [];
  let siteLabelMarkers = [];

  fetch('/SitePosition.json')
    .then(res => res.json())
    .then(siteData => {
      siteData.features.forEach(f => {
        const [lng, lat] = f.geometry.coordinates;
        const name = f.properties.SiteName;
        const isMainnode = f.properties.MainNode === "Mainnode";
        const isHubVibaBackbone = f.properties.MainNode === "HubVibaBackbone";

        const iconMarker = L.circleMarker([lat, lng], {
          radius: isMainnode ? 3 : isHubVibaBackbone ? 2 : 1,
          color: isMainnode ? '#ff0000' : isHubVibaBackbone ? '#0000FF' : '#800000',
          fillColor: isMainnode ? '#ff0000' : isHubVibaBackbone ? '#0000FF' : '#800000',
          fillOpacity: 1
        });
        siteIconMarkers.push(iconMarker);

        const labelIcon = L.divIcon({
          className: 'site-label',
          html: `<div style="text-align: center; font-size: 8px; font-weight: ${isMainnode || isHubVibaBackbone ? 'bold' : 'normal'}; color: ${isMainnode ? '#ff0000' : isHubVibaBackbone ? '#0000FF' : '#800000'}; white-space: nowrap;">${name}</div>`,
          iconSize: [0, 0],
          iconAnchor: [15, -3]
        });
        const labelMarker = L.marker([lat, lng], { icon: labelIcon });
        siteLabelMarkers.push(labelMarker);
      });

      // Kiểm tra checkbox tồn tại trước khi dùng
      const toggleIcon = document.getElementById('toggleSiteIcon');
      const toggleLabel = document.getElementById('toggleSiteLabel');

      if (toggleIcon?.checked) {
        siteIconMarkers.forEach(m => m.addTo(map));
      }
      if (toggleLabel?.checked) {
        siteLabelMarkers.forEach(m => m.addTo(map));
      }

      if (toggleIcon) {
        toggleIcon.addEventListener('change', function () {
          siteIconMarkers.forEach(m => this.checked ? map.addLayer(m) : map.removeLayer(m));
        });
      } else {
        console.warn("⚠️ Không tìm thấy checkbox #toggleSiteIcon");
      }

      if (toggleLabel) {
        toggleLabel.addEventListener('change', function () {
          siteLabelMarkers.forEach(m => this.checked ? map.addLayer(m) : map.removeLayer(m));
        });
      } else {
        console.warn("⚠️ Không tìm thấy checkbox #toggleSiteLabel");
      }
    })
    .catch(err => console.error('Không tải được dữ liệu SitePosition:', err));
});
