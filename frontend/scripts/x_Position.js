document.addEventListener('DOMContentLoaded', () => {
  const MARKER_CONFIG = {
    police: {
      url: '/load_markers?type=police',
      nameField: 'PoliceName',
      iconUrl: '/frontend/images/pnh_logo.png',
      textColor: '#800000',
      iconSize: [16, 16],
      iconAnchor: [6, 16],
      popupAnchor: [0, -16],
      textAnchor: [-8, 16],
      className: 'police-label',
      iconToggleId: 'togglePoliceIcon',
      labelToggleId: 'togglePoliceLabel'
    },
    bandit: {
      url: '/load_markers?type=bandit',
      nameField: 'BanditName',
      iconUrl: '/frontend/images/bandit_logo.png',
      textColor: '#000000',
      iconSize: [16, 16],
      iconAnchor: [8, 16],
      popupAnchor: [0, -16],
      textAnchor: [-10, 16],
      className: 'bandit-label',
      iconToggleId: 'toggleBanditIcon',
      labelToggleId: 'toggleBanditLabel'
    },
    showroom: {
      url: '/load_markers?type=showroom',
      nameField: 'ShowroomName',
      iconUrl: '/frontend/images/showroom_logo.png',
      textColor: '#f1c40f',
      iconSize: [16, 16],
      iconAnchor: [8, 16],
      popupAnchor: [0, -16],
      textAnchor: [-10, 16],
      className: 'showroom-label',
      iconToggleId: 'toggleShowroomIcon',
      labelToggleId: 'toggleShowroomLabel'
    }
  };

  function dispatchLoaded(markerType) {
    document.dispatchEvent(new CustomEvent('operationalMarkersLoaded', {
      detail: { markerType }
    }));
  }

  function loadMarkerType(markerType) {
    const config = MARKER_CONFIG[markerType];
    window[`${markerType}Icons`] = window[`${markerType}Icons`] || [];
    window[`${markerType}Labels`] = window[`${markerType}Labels`] || [];

    const iconMarkers = window[`${markerType}Icons`];
    const labelMarkers = window[`${markerType}Labels`];
    const iconToggle = document.getElementById(config.iconToggleId);
    const labelToggle = document.getElementById(config.labelToggleId);

    function syncVisibility() {
      if (typeof window.syncOperationalMarkerVisibility === 'function') {
        window.syncOperationalMarkerVisibility(markerType);
        return;
      }

      iconMarkers.forEach(marker => {
        if (iconToggle?.checked) map.addLayer(marker);
        else map.removeLayer(marker);
      });

      labelMarkers.forEach(marker => {
        if (labelToggle?.checked) map.addLayer(marker);
        else map.removeLayer(marker);
      });
    }

    fetch(config.url)
      .then(async res => {
        window.markerDataVersions = window.markerDataVersions || {};
        window.markerDataVersions[markerType] = res.headers.get('X-Data-Version') || 'missing';
        return res.json();
      })
      .then(siteData => {
        const customIcon = L.icon({
          iconUrl: config.iconUrl,
          iconSize: config.iconSize,
          iconAnchor: config.iconAnchor,
          popupAnchor: config.popupAnchor
        });

        siteData.features.forEach(feature => {
          const [lng, lat] = feature.geometry.coordinates;
          const name = feature.properties[config.nameField];

          const iconMarker = L.marker([lat, lng], { icon: customIcon })
            .bindPopup(`<strong>${name}</strong>`);

          if (typeof window.registerOperationalMarker === 'function') {
            window.registerOperationalMarker(iconMarker, markerType);
          } else {
            iconMarkers.push(iconMarker);

            const labelIcon = L.divIcon({
              className: config.className,
              html: `<div style="text-align: center; font-size: 8px; font-weight: bold; color: ${config.textColor}; white-space: nowrap;">${name}</div>`,
              iconSize: config.iconSize,
              iconAnchor: config.textAnchor
            });

            const labelMarker = L.marker([lat, lng], { icon: labelIcon });
            labelMarkers.push(labelMarker);
          }
        });

        syncVisibility();
        dispatchLoaded(markerType);
      })
      .catch(err => console.error(`Không tải được dữ liệu ${markerType}:`, err));

    iconToggle?.addEventListener('change', syncVisibility);
    labelToggle?.addEventListener('change', syncVisibility);

    syncVisibility();
  }

  Object.keys(MARKER_CONFIG).forEach(loadMarkerType);

  const hqIcons = [];
  const hqLabels = [];

  fetch('/HQ_Position.json')
    .then(res => res.json())
    .then(siteData => {
      siteData.features.forEach(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        const name = feature.properties.HQName;

        const iconUrl = name === 'Natcom_HQ'
          ? '/frontend/images/natcom_logo.png'
          : '/frontend/images/hq_logo.png';

        const customIcon = L.icon({
          iconUrl,
          iconSize: [32, 32],
          iconAnchor: [8, 16],
          popupAnchor: [0, -16]
        });

        const iconMarker = L.marker([lat, lng], { icon: customIcon })
          .bindPopup(`<strong>${name}</strong>`);
        hqIcons.push(iconMarker);

        const labelIcon = L.divIcon({
          className: 'hq-label',
          html: `<div style="text-align: center; font-size: 9px; font-weight: bold; color: #ffffff; white-space: nowrap;">${name}</div>`,
          iconSize: [32, 32],
          iconAnchor: [-15, 16]
        });

        const labelMarker = L.marker([lat, lng], { icon: labelIcon });
        hqLabels.push(labelMarker);
      });

      if (document.getElementById('toggleHQIcon').checked) {
        hqIcons.forEach(marker => marker.addTo(map));
      }
      if (document.getElementById('toggleHQLabel').checked) {
        hqLabels.forEach(marker => marker.addTo(map));
      }
    })
    .catch(err => console.error('Không tải được HQ_Position.json:', err));

  document.getElementById('toggleHQIcon').addEventListener('change', function () {
    hqIcons.forEach(marker => this.checked ? map.addLayer(marker) : map.removeLayer(marker));
  });

  document.getElementById('toggleHQLabel').addEventListener('change', function () {
    hqLabels.forEach(marker => this.checked ? map.addLayer(marker) : map.removeLayer(marker));
  });
});
