window.HaitiMapApp = window.HaitiMapApp || {};

(function initializeAuthUi(app) {
  const ROLE_LEVELS = { guest: 1, editor: 2, admin: 3 };

  function normalizeRole(role) {
    const normalized = String(role || '').toLowerCase();
    return ROLE_LEVELS[normalized] ? normalized : 'guest';
  }

  function hasRole(requiredRole) {
    const currentRole = normalizeRole(app.state?.auth?.role);
    return ROLE_LEVELS[currentRole] >= ROLE_LEVELS[normalizeRole(requiredRole)];
  }

  function applyRoleVisibility() {
    document.querySelectorAll('[data-required-role]').forEach(element => {
      const requiredRole = element.dataset.requiredRole;
      const allowed = hasRole(requiredRole);
      if (element.classList.contains('control-section') || element.classList.contains('admin-user-tools')) {
        element.hidden = !allowed;
      } else {
        element.hidden = false;
        if ('disabled' in element) {
          element.disabled = !allowed;
        }
        element.classList.toggle('is-role-disabled', !allowed);
      }
    });
  }

  function updateSessionUi() {
    const user = app.state.auth.user;
    const usernameEl = document.getElementById('currentUsername');
    const roleEl = document.getElementById('currentUserRole');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const changePasswordBtn = document.getElementById('changePasswordBtn');

    if (usernameEl) usernameEl.textContent = user?.username || 'Guest';
    if (roleEl) roleEl.textContent = user ? (user.role || 'guest').toUpperCase() : 'GUEST';
    if (loginBtn) loginBtn.hidden = !!user;
    if (logoutBtn) logoutBtn.hidden = !user;
    if (changePasswordBtn) changePasswordBtn.hidden = !user;
  }

  async function loadCurrentUser() {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (response.status === 401) {
      app.state.auth.isAuthenticated = false;
      app.state.auth.user = null;
      app.state.auth.role = 'guest';
      updateSessionUi();
      applyRoleVisibility();
      return;
    }

    const payload = await response.json();
    app.state.auth.isAuthenticated = true;
    app.state.auth.user = payload.user;
    app.state.auth.role = normalizeRole(payload.user?.role);
    app.services.hasRole = hasRole;
    updateSessionUi();
    applyRoleVisibility();
    app.events.emit('authStateReady', { user: payload.user });
  }

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => null);
    app.state.auth.isAuthenticated = false;
    app.state.auth.user = null;
    app.state.auth.role = 'guest';
    updateSessionUi();
    applyRoleVisibility();
    loadUsers();
  }

  function ensureLoginModal() {
    if (document.getElementById('loginModalBackdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'loginModalBackdrop';
    backdrop.className = 'auth-modal-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <div class="auth-modal">
        <h3>Đăng nhập</h3>
        <label for="authUsername">Tên đăng nhập</label>
        <input id="authUsername" type="text" autocomplete="username" />
        <label for="authPassword">Mật khẩu</label>
        <input id="authPassword" type="password" autocomplete="current-password" />
        <div id="authErrorMessage" class="auth-error"></div>
        <div class="auth-modal-actions">
          <button id="closeLoginModalBtn" type="button" class="ghost-button">Đóng</button>
          <button id="submitLoginBtn" type="button">Đăng nhập</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) {
        backdrop.hidden = true;
      }
    });

    document.getElementById('closeLoginModalBtn')?.addEventListener('click', () => {
      backdrop.hidden = true;
    });

    document.getElementById('submitLoginBtn')?.addEventListener('click', loginFromModal);
    ['authUsername', 'authPassword'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          loginFromModal();
        }
      });
    });
  }

  function ensureChangePasswordModal() {
    if (document.getElementById('changePasswordModalBackdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'changePasswordModalBackdrop';
    backdrop.className = 'auth-modal-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <div class="auth-modal">
        <h3>Đổi mật khẩu</h3>
        <label for="modalCurrentPassword">Mật khẩu cũ</label>
        <input id="modalCurrentPassword" type="password" />
        <label for="modalNewPassword">Mật khẩu mới</label>
        <input id="modalNewPassword" type="password" />
        <label for="modalConfirmPassword">Nhập lại mật khẩu mới</label>
        <input id="modalConfirmPassword" type="password" />
        <div id="changePasswordError" class="auth-error"></div>
        <div class="auth-modal-actions">
          <button id="closeChangePasswordBtn" type="button" class="ghost-button">Đóng</button>
          <button id="submitChangePasswordBtn" type="button">Đổi mật khẩu</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) backdrop.hidden = true;
    });
    document.getElementById('closeChangePasswordBtn')?.addEventListener('click', () => {
      backdrop.hidden = true;
    });
    document.getElementById('submitChangePasswordBtn')?.addEventListener('click', changeOwnPassword);
  }

  function ensureCreateUserModal() {
    if (document.getElementById('createUserModalBackdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'createUserModalBackdrop';
    backdrop.className = 'auth-modal-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <div class="auth-modal">
        <h3>Tạo user</h3>
        <label for="newUsernameInput">Username mới</label>
        <input id="newUsernameInput" type="text" />
        <label>Mật khẩu mặc định</label>
        <input type="text" value="Natcom@123" readonly />
        <div id="createUsersError" class="auth-error"></div>
        <div class="auth-modal-actions">
          <button id="closeCreateUsersBtn" type="button" class="ghost-button">Đóng</button>
          <button id="createUserBtn" type="button">Tạo user</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) backdrop.hidden = true;
    });
    document.getElementById('closeCreateUsersBtn')?.addEventListener('click', () => {
      backdrop.hidden = true;
    });
    document.getElementById('createUserBtn')?.addEventListener('click', createEditorUser);
  }

  function ensureDeleteUserModal() {
    if (document.getElementById('deleteUserModalBackdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'deleteUserModalBackdrop';
    backdrop.className = 'auth-modal-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <div class="auth-modal">
        <h3>Xóa user</h3>
        <label for="existingUsersSelect">User hiện có</label>
        <select id="existingUsersSelect"></select>
        <div id="deleteUsersError" class="auth-error"></div>
        <div class="auth-modal-actions compact">
          <button id="resetSelectedUserPasswordBtn" type="button" class="ghost-button">Set password</button>
          <button id="deleteSelectedUserBtn" type="button" class="danger ghost">Xóa user</button>
        </div>
        <div class="auth-modal-actions">
          <button id="closeDeleteUsersBtn" type="button" class="ghost-button">Đóng</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) backdrop.hidden = true;
    });
    document.getElementById('closeDeleteUsersBtn')?.addEventListener('click', () => {
      backdrop.hidden = true;
    });
    document.getElementById('deleteSelectedUserBtn')?.addEventListener('click', deleteSelectedUser);
    document.getElementById('resetSelectedUserPasswordBtn')?.addEventListener('click', resetSelectedUserPassword);
  }

  async function loginFromModal() {
    const username = document.getElementById('authUsername')?.value.trim() || '';
    const password = document.getElementById('authPassword')?.value || '';
    const errorEl = document.getElementById('authErrorMessage');

    if (errorEl) errorEl.textContent = '';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Đăng nhập thất bại');
      }

      app.state.auth.isAuthenticated = true;
      app.state.auth.user = payload.user;
      app.state.auth.role = normalizeRole(payload.user?.role);
      updateSessionUi();
      applyRoleVisibility();
      document.getElementById('loginModalBackdrop').hidden = true;
      app.events.emit('authStateReady', { user: payload.user });
      await loadUsers();
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message;
    }
  }

  function openLoginModal() {
    ensureLoginModal();
    const backdrop = document.getElementById('loginModalBackdrop');
    if (!backdrop) return;
    backdrop.hidden = false;
    document.getElementById('authErrorMessage').textContent = '';
    document.getElementById('authUsername')?.focus();
  }

  async function changeOwnPassword() {
    if (!app.state.auth.user) return;
    const currentPassword = document.getElementById('modalCurrentPassword')?.value || '';
    const newPassword = document.getElementById('modalNewPassword')?.value || '';
    const confirmPassword = document.getElementById('modalConfirmPassword')?.value || '';
    const errorEl = document.getElementById('changePasswordError');

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      if (errorEl) errorEl.textContent = 'Vui lòng nhập đầy đủ thông tin';
      return;
    }
    if (newPassword !== confirmPassword) {
      if (errorEl) errorEl.textContent = 'Mật khẩu mới nhập lại không khớp';
      return;
    }
    if (errorEl) errorEl.textContent = '';

    const response = await fetch('/api/auth/password', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: currentPassword.trim(),
        new_password: newPassword.trim(),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (errorEl) errorEl.textContent = payload.message || 'Không thể đổi mật khẩu';
      return;
    }

    document.getElementById('modalCurrentPassword').value = '';
    document.getElementById('modalNewPassword').value = '';
    document.getElementById('modalConfirmPassword').value = '';
    document.getElementById('changePasswordModalBackdrop').hidden = true;
    alert('✅ Đổi mật khẩu thành công');
  }

  function renderUsers(users) {
    const select = document.getElementById('existingUsersSelect');
    if (!select) return;

    const options = users.map(user => `<option value="${user.username}">${user.username}</option>`).join('');
    select.innerHTML = options || '<option value="">Không có user</option>';
  }

  async function loadUsers() {
    if (!hasRole('admin')) {
      const select = document.getElementById('existingUsersSelect');
      if (select) select.innerHTML = '';
      return;
    }
    const response = await fetch('/api/users', { credentials: 'same-origin' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload.message || 'Không tải được danh sách user');
      return;
    }
    renderUsers(payload.users || []);
  }

  async function createEditorUser() {
    const username = document.getElementById('newUsernameInput')?.value.trim() || '';
    const errorEl = document.getElementById('createUsersError');

    const response = await fetch('/api/users', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (errorEl) errorEl.textContent = payload.message || 'Không tạo được user';
      return;
    }

    if (errorEl) errorEl.textContent = '';
    document.getElementById('newUsernameInput').value = '';
    document.getElementById('createUserModalBackdrop').hidden = true;
    await loadUsers();
  }

  async function deleteSelectedUser() {
    const username = document.getElementById('existingUsersSelect')?.value || '';
    const errorEl = document.getElementById('deleteUsersError');
    if (!username) {
      if (errorEl) errorEl.textContent = 'Không có user để xóa';
      return;
    }
    if (!confirm(`Xóa user ${username}?`)) return;

    const response = await fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (errorEl) errorEl.textContent = payload.message || 'Không thể xóa user';
      return;
    }

    if (errorEl) errorEl.textContent = '';
    document.getElementById('deleteUserModalBackdrop').hidden = true;
    await loadUsers();
  }

  async function resetSelectedUserPassword() {
    const username = document.getElementById('existingUsersSelect')?.value || '';
    const errorEl = document.getElementById('deleteUsersError');
    if (!username) {
      if (errorEl) errorEl.textContent = 'Không có user để đặt lại mật khẩu';
      return;
    }
    const password = prompt(`Nhập mật khẩu mới cho ${username}:`);
    if (!password || !password.trim()) return;

    const response = await fetch(`/api/users/${encodeURIComponent(username)}/password`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.trim() }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (errorEl) errorEl.textContent = payload.message || 'Không thể đặt lại mật khẩu';
      return;
    }

    if (errorEl) errorEl.textContent = '';
    alert(`✅ Đã đặt lại mật khẩu cho ${username}`);
  }

  function bindUserManagement() {
    document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
      ensureChangePasswordModal();
      const backdrop = document.getElementById('changePasswordModalBackdrop');
      if (!backdrop) return;
      document.getElementById('changePasswordError').textContent = '';
      document.getElementById('modalCurrentPassword').value = '';
      document.getElementById('modalNewPassword').value = '';
      document.getElementById('modalConfirmPassword').value = '';
      backdrop.hidden = false;
      document.getElementById('modalCurrentPassword')?.focus();
    });

    document.getElementById('createUserModalBtn')?.addEventListener('click', () => {
      ensureCreateUserModal();
      const backdrop = document.getElementById('createUserModalBackdrop');
      if (!backdrop) return;
      document.getElementById('createUsersError').textContent = '';
      document.getElementById('newUsernameInput').value = '';
      backdrop.hidden = false;
      document.getElementById('newUsernameInput')?.focus();
    });

    document.getElementById('deleteUserModalBtn')?.addEventListener('click', async () => {
      ensureDeleteUserModal();
      const backdrop = document.getElementById('deleteUserModalBackdrop');
      if (!backdrop) return;
      document.getElementById('deleteUsersError').textContent = '';
      await loadUsers();
      backdrop.hidden = false;
      document.getElementById('existingUsersSelect')?.focus();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    app.services.hasRole = hasRole;
    ensureLoginModal();
    ensureChangePasswordModal();
    ensureCreateUserModal();
    ensureDeleteUserModal();
    document.getElementById('loginBtn')?.addEventListener('click', openLoginModal);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    bindUserManagement();
    loadCurrentUser().then(loadUsers);
  });
})(window.HaitiMapApp);
