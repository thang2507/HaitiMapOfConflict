var haitiMapApp = window.HaitiMapApp || (window.HaitiMapApp = {});
haitiMapApp.services = haitiMapApp.services || {};

function getMarkerKeyHeader() {
  return {};
}

function ensureAppAlertStyles() {
  if (document.getElementById('appAlertStyles')) return;

  const style = document.createElement('style');
  style.id = 'appAlertStyles';
  style.textContent = `
    .app-alert-backdrop {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 8px;
      pointer-events: none;
      z-index: 5000;
    }
    .app-alert-modal {
      width: min(360px, calc(100vw - 24px));
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
      padding: 12px 14px;
      font-family: Arial, sans-serif;
      color: #1f2937;
      pointer-events: auto;
    }
    .app-alert-title {
      margin: 0 0 6px;
      font-size: 13px;
      font-weight: 700;
    }
    .app-alert-message {
      font-size: 13px;
      line-height: 1.35;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .app-alert-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }
    .app-alert-btn {
      min-width: 72px;
      padding: 6px 12px;
      border: none;
      border-radius: 8px;
      background: #2563eb;
      color: #fff;
      font-size: 13px;
      cursor: pointer;
    }
    .app-alert-btn:hover {
      background: #1d4ed8;
    }
  `;
  document.head.appendChild(style);
}

function isSuccessAlertMessage(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('✅') || text.includes('thành công') || text.includes('đã lưu') || text.includes('không có thay đổi');
}

function showAppAlert(message) {
  ensureAppAlertStyles();

  const backdrop = document.createElement('div');
  backdrop.className = 'app-alert-backdrop';

  const modal = document.createElement('div');
  modal.className = 'app-alert-modal';

  const title = document.createElement('div');
  title.className = 'app-alert-title';
  title.textContent = 'HaitiMapOfConflict';

  const body = document.createElement('div');
  body.className = 'app-alert-message';
  body.textContent = String(message || '');

  const actions = document.createElement('div');
  actions.className = 'app-alert-actions';

  const button = document.createElement('button');
  button.className = 'app-alert-btn';
  button.type = 'button';
  button.textContent = 'OK';

  actions.appendChild(button);
  modal.appendChild(title);
  modal.appendChild(body);
  modal.appendChild(actions);
  backdrop.appendChild(modal);

  const close = () => {
    if (document.body.contains(backdrop)) {
      document.body.removeChild(backdrop);
    }
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = event => {
    if (event.key === 'Escape' || event.key === 'Enter') {
      close();
    }
  };

  button.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(backdrop);

  if (isSuccessAlertMessage(message)) {
    title.style.display = 'none';
    actions.style.display = 'none';
    window.setTimeout(close, 3000);
  }
}

window.alert = showAppAlert;

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithMarkerAuth(url, options = {}, settings = {}) {
  const { timeoutMs = 10000, redirectOnUnauthorized = true } = settings;
  const headers = { ...(options.headers || {}) };

  let response = await fetchWithTimeout(url, { ...options, headers }, timeoutMs);
  if (response.status !== 401 || !redirectOnUnauthorized) {
    return response;
  }
  window.location.href = '/login';
  return response;
}

haitiMapApp.services.getMarkerKeyHeader = getMarkerKeyHeader;
haitiMapApp.services.fetchWithTimeout = fetchWithTimeout;
haitiMapApp.services.fetchWithMarkerAuth = fetchWithMarkerAuth;

window.getMarkerKeyHeader = getMarkerKeyHeader;
window.fetchWithTimeout = fetchWithTimeout;
window.fetchWithMarkerAuth = fetchWithMarkerAuth;
