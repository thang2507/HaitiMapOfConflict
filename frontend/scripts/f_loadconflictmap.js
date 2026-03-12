let conflictLayer;
let activeConflictMenu = null;

function closeConflictMenu() {
  if (activeConflictMenu && document.body.contains(activeConflictMenu)) {
    document.body.removeChild(activeConflictMenu);
  }
  activeConflictMenu = null;
}

document.addEventListener('contextmenu', event => {
  event.preventDefault();
});
document.addEventListener('click', () => {
  closeConflictMenu();
});
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
  fetchWithTimeout('/Haiti_conflict_map.geojson', {}, 10000)
    .then(res => {
      if (!res.ok) throw new Error(`/Haiti_conflict_map.geojson failed: ${res.status}`);
      window.conflictDataVersion = res.headers.get('X-Data-Version') || 'missing';
      return res.json();
    })
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
            if (e.originalEvent) {
              e.originalEvent.preventDefault();
              e.originalEvent.stopPropagation();
            }
            closeConflictMenu();
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
              option.addEventListener('click', async () => {
                const previousLevel = feature.properties.conflict_level;
                try {
                  feature.properties.conflict_level = level;
                  layer.setStyle({
                    fillColor: getColor(level),
                    fillOpacity: level === 'empty' ? 0 : 0.6
                  });
                  const response = await fetchWithMarkerAuth('/save_conflict_data', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Data-Version': window.conflictDataVersion || 'missing'
                    },
                    body: JSON.stringify([{
                      name: feature.properties.ADM3_EN,
                      conflict_level: level
                    }])
                  });
                  if (!response.ok) {
                    if (response.status === 409) {
                      const conflict = await response.json();
                      window.conflictDataVersion = conflict.current_version || 'missing';
                      throw new Error('Dữ liệu conflict đã bị người khác thay đổi. App sẽ tải lại.');
                    }
                    const text = await response.text();
                    throw new Error(text || 'Không lưu được conflict level');
                  }
                  const result = await response.json();
                  window.conflictDataVersion = result.version || response.headers.get('X-Data-Version') || 'missing';
                  alert('✅ Thay đổi thành công!');
                } catch (error) {
                  feature.properties.conflict_level = previousLevel;
                  layer.setStyle({
                    fillColor: getColor(previousLevel),
                    fillOpacity: previousLevel === 'empty' ? 0 : 0.6
                  });
                  if (error.message.includes('App sẽ tải lại')) {
                    loadConflictMap();
                  }
                  alert(`❌ ${error.message}`);
                }
                closeConflictMenu();
              });
              menu.appendChild(option);
            });

            document.body.appendChild(menu);
            activeConflictMenu = menu;
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
