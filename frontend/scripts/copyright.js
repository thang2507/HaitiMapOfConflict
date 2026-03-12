const copyrightControl = L.control({ position: 'bottomleft' });
copyrightControl.onAdd = function (map) {
  const div = L.DomUtil.create('div', 'copyright-control');
  div.innerHTML = `
    <div style="
      text-align: left;
      font-size: 12px;
      font-weight: normal;
      color: #555;
      background: transparent;
      padding: 5px 10px;
      border-radius: 5px;
      box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);">
      © 2025 by Natcom.
    </div>
  `;
  return div;
};

//copyrightControl.addTo(map);