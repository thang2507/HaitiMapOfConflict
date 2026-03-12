let conflictLayer;
    function getColor(conflictLevel) {
      switch (conflictLevel) {
        case 'level0': return '#2ecc71';
        case 'level1': return '#f1c40f';
        case 'level2': return '#e74c3c';
        case 'level3': return '#FF9900';
        case 'level4': return '#3366CC';
        case 'level5': return '#CC66FF';
        case 'level6': return '#CC9900';
        case 'level7': return '#663300';
        case 'level8': return '#336699';
        case 'level9': return '#336666';
        case 'level10': return '#009966';
        case 'empty': return '#ffffff00'; // trong suốt
        default: return '#bdc3c7';
      }
    }

  function loadConflictMap() {
  fetch('/Haiti_conflict_map.geojson')
    .then(res => res.json())
    .then(data => {
      if (conflictLayer) map.removeLayer(conflictLayer);
      conflictLayer = L.geoJSON(data, {
        style: f => ({
          color: '#333',
          weight: 1,
          fillColor: getColor(f.properties.conflict_level),
          fillOpacity: f.properties.conflict_level === 'empty' ? 0 : 0.6
        }),
        onEachFeature: (feature, layer) => {
          const name = feature.properties.ADM3_EN || "Không rõ";
          layer.on('mouseout', () => map.closePopup());
          layer.on('click', () => layer.bindPopup(`<strong>${name}</strong>`).openPopup());
          layer.on('contextmenu', e => {
            const menu = document.createElement('div');
            menu.style.position = 'absolute';
            menu.style.left = `${e.originalEvent.pageX}px`;
            menu.style.top = `${e.originalEvent.pageY}px`;
            menu.style.background = 'white';
            menu.style.border = '1px solid #ccc';
            menu.style.padding = '5px';
            menu.style.zIndex = 1000;

            ['level0', 'level1', 'level2', 'empty'].forEach(level => {
              const option = document.createElement('div');
              option.textContent = level;
              option.style.cursor = 'pointer';
              option.style.padding = '5px';
              option.style.background = getColor(level);
              option.style.color = 'black';
              option.addEventListener('click', () => {
                const password = prompt('Nhập mật khẩu để thay đổi:');
                if (password === '2808') {
                  feature.properties.conflict_level = level;
                  layer.setStyle({
                    fillColor: getColor(level),
                    fillOpacity: level === 'empty' ? 0 : 0.6
                  });
                  alert('✅ Thay đổi thành công!');
                } else {
                  alert('❌ Mật khẩu không đúng!');
                }
                document.body.removeChild(menu);
              });
              menu.appendChild(option);
            });

            document.addEventListener('click', function removeMenu() {
              if (document.body.contains(menu)) {
                document.body.removeChild(menu);
                document.removeEventListener('click', removeMenu);
              }
            });

            document.body.appendChild(menu);
          });
        }
      }).addTo(map);

      map.fitBounds(conflictLayer.getBounds());
    })
    .catch(err => console.error('Không tải được bản đồ xung đột:', err));
}

    loadConflictMap(); // Load khi trang mở

    document.addEventListener('DOMContentLoaded', function () {
      const slider = document.getElementById('opacitySlider');
      if (slider) {
        slider.addEventListener('input', function () {
          const newOpacity = parseFloat(this.value);
          if (conflictLayer) {
            conflictLayer.setStyle(f => {
              const level = f?.feature?.properties?.conflict_level;
              return {
                fillOpacity: level === 'empty' ? 0 : newOpacity
              };
            });
            
          }
        });
      } else {
        console.warn("⚠️ Không tìm thấy phần tử #opacitySlider");
      }
    });