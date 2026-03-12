// === Khởi tạo các layer ===
const drawnItems = new L.FeatureGroup();
const arrowLayerGroup = L.layerGroup();
map.addLayer(drawnItems);
map.addLayer(arrowLayerGroup);

// === Lấy màu và độ mờ hiện tại ===
function getSelectedColor() {
    return document.getElementById('drawingColor')?.value || '#ff0000';
}
function getCurrentOpacity() {
    const slider = document.getElementById('opacitySlider');
    return slider ? parseFloat(slider.value) : 0.8;
}

async function saveDrawings() {
    const geojson = {
        type: "FeatureCollection",
        features: drawnItems.getLayers().map(layer => {
            const feature = layer.toGeoJSON();
            feature.properties = feature.properties || {};

            if (layer instanceof L.Circle) {
                feature.properties.radius = layer.getRadius();
                feature.geometry = {
                    type: "Point",
                    coordinates: [layer.getLatLng().lng, layer.getLatLng().lat]
                };
            }

            if (layer instanceof L.Marker && !(layer instanceof L.CircleMarker)) {
                feature.properties.type = "marker";
            }

            if (layer.getTooltip && layer.getTooltip()) {
                const tooltipText = layer.getTooltip().getContent();
                if (tooltipText) {
                    feature.properties.text = tooltipText;
                }
            }
            return feature;
        })
    };

    const response = await fetchWithMarkerAuth('/save_drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geojson)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Không lưu được drawings');
    }
}

// === Color Picker Control ===
const ColorPickerControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom leaflet-control-colorpicker');
        container.style.backgroundColor = 'white';
        container.style.padding = '1px';
        container.innerHTML = `
            <label style="font-size:10px;">Màu vẽ</label><br>
            <input type="color" id="drawingColor" value="#e74c3c" style="width:100%;">
        `;
        L.DomEvent.disableClickPropagation(container);
        return container;
    }
});
map.addControl(new ColorPickerControl());

// === Leaflet.Draw control ===
const drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: {
        polygon: { shapeOptions: { color: getSelectedColor, fillOpacity: getCurrentOpacity } },
        polyline: { shapeOptions: { color: getSelectedColor } },
        rectangle: { shapeOptions: { color: getSelectedColor, fillOpacity: getCurrentOpacity } },
        circle: { shapeOptions: { color: getSelectedColor, fillOpacity: getCurrentOpacity } },
        marker: true,
        circlemarker: false
    }
});
map.addControl(drawControl);

// Cập nhật màu khi bắt đầu vẽ
map.on('draw:drawstart', function () {
    const color = getSelectedColor();
    const opacity = getCurrentOpacity();
    drawControl.setDrawingOptions({
        polygon: { shapeOptions: { color, fillOpacity: opacity } },
        polyline: { shapeOptions: { color } },
        rectangle: { shapeOptions: { color, fillOpacity: opacity } },
        circle: { shapeOptions: { color, fillOpacity: opacity } }
    });
});

// Khi vẽ xong
map.on(L.Draw.Event.CREATED, function (e) {
    const layer = e.layer;
    const color = getSelectedColor();
    const opacity = getCurrentOpacity();

    if (!layer.feature) layer.feature = { type: 'Feature', properties: {} };
    layer.feature.properties.color = color;

    if (layer.setStyle) {
        layer.setStyle({ color, fillOpacity: opacity, opacity: opacity });
    }

    const userText = prompt("Text (nếu có):");
    if (userText && userText.trim()) {
        layer.bindTooltip(userText.trim(), {
            permanent: true,
            direction: 'center',
            className: 'custom-tooltip',
            interactive: false
        }).openTooltip();
        
        layer.feature.properties.text = userText.trim();
    }

    drawnItems.addLayer(layer);

    if (typeof layer.arrowheads === 'function' && layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        layer.arrowheads({
            size: '20px',
            frequency: 0.3,
            yawn: 60,
            color: color,
            fill: true
        });
    }

    saveDrawings().catch(err => {
        console.error(err);
        alert(`❌ ${err.message}`);
    });
});

map.on(L.Draw.Event.EDITED, () => {
    saveDrawings().catch(err => {
        console.error(err);
        alert(`❌ ${err.message}`);
    });
});
map.on(L.Draw.Event.DELETED, () => {
    saveDrawings().catch(err => {
        console.error(err);
        alert(`❌ ${err.message}`);
    });
});

fetchWithTimeout('/load_drawings', {}, 10000)
    .then(res => {
        if (!res.ok) throw new Error(`/load_drawings failed: ${res.status}`);
        return res.json();
    })
    .then(data => {
        const geojsonLayer = L.geoJSON(data, {
            style: function (feature) {
                return {
                    color: feature.properties?.color || '#3388ff',
                    fillOpacity: getCurrentOpacity(),
                    opacity: getCurrentOpacity()
                };
            },
            pointToLayer: function (feature, latlng) {
                if (feature.properties && feature.properties.radius) {
                    return L.circle(latlng, {
                        radius: feature.properties.radius,
                        color: feature.properties.color || '#3388ff',
                        fillOpacity: getCurrentOpacity(),
                        opacity: getCurrentOpacity()
                    });
                } else if (feature.properties?.type === "marker") {
                    return L.marker(latlng);
                }
                return L.circleMarker(latlng, {
                    radius: 6,
                    color: feature.properties?.color || '#3388ff',
                    fillOpacity: 1
                });
            }
        });

        geojsonLayer.eachLayer(layer => {
            const text = layer.feature?.properties?.text;
            if (text) {
                layer.bindTooltip(text, {
                    permanent: true,
                    direction: 'center',
                    className: 'custom-tooltip'
                }).openTooltip();
            }
            drawnItems.addLayer(layer);

            if (typeof layer.arrowheads === 'function' && layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                const color = layer.feature?.properties?.color || '#3388ff';
                layer.arrowheads({
                    size: '20px',
                    frequency: 0.4,
                    yawn: 60,
                    color: color,
                    fill: true,
                    clickable: false
                });
            }
        });
    });

document.addEventListener("DOMContentLoaded", function () {
    const checkbox = document.getElementById('toggleDrawnItems');
    const opacitySlider = document.getElementById('opacitySlider');
    if (checkbox) {
        checkbox.addEventListener('change', function () {
            if (this.checked) {
                map.addLayer(drawnItems);
            } else {
                map.removeLayer(drawnItems);
            }
        });
    }

    if (opacitySlider) {
        opacitySlider.addEventListener('input', function () {
            const newOpacity = parseFloat(this.value);
            drawnItems.eachLayer(layer => {
    if (layer.setStyle) {
        const level = layer.feature?.properties?.conflict_level;
        const style = {
            fillOpacity: level === 'empty' ? 0 : newOpacity,
            opacity: level === 'empty' ? 0 : newOpacity
        };
        layer.setStyle(style);
    }
});
        });
    }
});

map.on('draw:deletestart', function () {
    drawnItems.eachLayer(layer => {
        if (layer.getTooltip()) {
            layer.unbindTooltip();
        }
    });
});

map.on('draw:deletestop', function () {
    drawnItems.eachLayer(layer => {
        const text = layer.feature?.properties?.text;
        if (text) {
            layer.bindTooltip(text, {
                permanent: true,
                direction: 'center',
                className: 'custom-tooltip',
                interactive: false
            }).openTooltip();
            
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const toggleDrawTools = document.getElementById('toggleDrawTools');
    const colorPickerControl = document.querySelector('.leaflet-control-colorpicker');

    if (toggleDrawTools) {
        toggleDrawTools.addEventListener('change', function () {
            // Ẩn/hiện các phần tử liên quan tới công cụ vẽ
            document.querySelectorAll('.leaflet-draw, .leaflet-draw-toolbar, .leaflet-draw-section').forEach(el => {
                el.style.display = this.checked ? 'block' : 'none';
            });

            if (colorPickerControl) {
                colorPickerControl.style.display = this.checked ? 'block' : 'none';
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const deleteButton = document.querySelector('.leaflet-draw-edit-remove');
  
    if (deleteButton) {
      // Clone nút và thay thế để gỡ event gốc
      const clone = deleteButton.cloneNode(true);
      deleteButton.parentNode.replaceChild(clone, deleteButton);
  
      clone.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation(); // ⛔ chặn event gốc Leaflet
  
        const password = prompt('Nhập mật khẩu để xóa:');
        if (password === '0305') {
          // ✅ Gọi sự kiện như bình thường sau khi đúng mật khẩu
          drawControl._toolbars.edit._modes.remove.handler.enable();
  
          // Gỡ tooltip nếu cần
          drawnItems.eachLayer(layer => {
            if (layer.getTooltip()) layer.unbindTooltip();
          });
        } else {
          alert('❌ Mật khẩu không đúng. Không thể xóa!');
        }
      });
    }
  });
  
  
