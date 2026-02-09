(async () => {
  const authRequired = document.body.dataset.auth === 'required';
  if (authRequired && !localStorage.getItem('dbdash_token')) {
    window.location.href = 'login.html';
    return;
  }

  const userPill = document.getElementById('user-pill');
  if (userPill) {
    try {
      const me = await apiRequest('/auth/me');
      window.currentUser = me;
      userPill.textContent = me.role === 'admin' ? `${me.name} (${me.role})` : me.name;
      const adminLinks = document.querySelectorAll('a[href="admin.html"]');
      adminLinks.forEach((link) => {
        if (me.role !== 'admin') {
          link.classList.add('hidden');
        }
      });
      if (me.role !== 'admin' && window.location.pathname.endsWith('/admin.html')) {
        window.location.href = 'dashboard.html';
        return;
      }
      userPill.addEventListener('click', () => {
        openProfileMenu(window.currentUser || me, userPill);
      });
    } catch (err) {
      setToken(null);
      window.location.href = 'login.html';
    }
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiRequest('/auth/logout', { method: 'POST' });
      } catch (err) {
        // ignore
      }
      setToken(null);
      window.location.href = 'login.html';
    });
  }
})();

if (!window.iconPaths) {
  window.iconPaths = {
    view: '/icons/visibility_26dp_FF7A3D_FILL0_wght400_GRAD0_opsz24.svg',
    edit: '/icons/edit_26dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg',
    delete: '/icons/delete_26dp_FFFFFF_FILL0_wght400_GRAD0_opsz24.svg',
  };
}

function ensureToastElement() {
  if (document.getElementById('toast')) return;
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast hidden';
  toast.textContent = 'Saved';
  document.body.appendChild(toast);
}

let toastTimer = null;
function showToast(message) {
  ensureToastElement();
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 1800);
}

window.showToast = showToast;

function ensureProfileModal() {
  if (document.getElementById('profile-modal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal hidden';
  modal.id = 'profile-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" data-profile-close></div>
    <div class="modal-card">
      <div class="modal-header">
        <h3>Edit profile</h3>
        <button class="modal-close" data-profile-close type="button">x</button>
      </div>
      <form id="profile-form" class="stack">
        <div class="modal-form-field">
          <label>Name</label>
          <input type="text" name="name" required />
        </div>
        <div class="modal-form-field">
          <label>Email</label>
          <input type="email" name="email" required />
        </div>
        <div class="modal-form-field">
          <label>Faculty number</label>
          <input type="text" name="faculty_number" />
        </div>
      </form>
      <div class="modal-actions">
        <button type="button" class="btn ghost" id="profile-cancel">Cancel</button>
        <button type="submit" class="btn" id="profile-save" form="profile-form">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openProfileModal(user) {
  ensureProfileModal();
  const modal = document.getElementById('profile-modal');
  const form = document.getElementById('profile-form');
  const cancel = document.getElementById('profile-cancel');
  const pill = document.getElementById('user-pill');

  form.name.value = user.name || '';
  form.email.value = user.email || '';
  form.faculty_number.value = user.faculty_number || '';

  const close = () => {
    modal.classList.add('hidden');
  };

  const onBackdrop = (event) => {
    if (event.target.matches('[data-profile-close]')) close();
  };

  modal.addEventListener('click', onBackdrop, { once: true });
  cancel.addEventListener('click', close, { once: true });

  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await apiRequest(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name.value.trim(),
          email: form.email.value.trim(),
          faculty_number: form.faculty_number.value.trim(),
        }),
      });
      const updated = await apiRequest('/auth/me');
      window.currentUser = updated;
      modal.classList.add('hidden');
      if (pill) {
        const label = updated.role === 'admin' ? `${updated.name} (${updated.role})` : updated.name;
        pill.textContent = label;
      }
      if (window.showToast) window.showToast('Profile saved');
    } catch (err) {
      alert(err.message);
    }
  };

  modal.classList.remove('hidden');
}

function ensurePasswordModal() {
  if (document.getElementById('password-modal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal hidden';
  modal.id = 'password-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" data-password-close></div>
    <div class="modal-card">
      <div class="modal-header">
        <h3>Change password</h3>
        <button class="modal-close" data-password-close type="button">x</button>
      </div>
      <form id="password-form" class="stack">
        <div class="modal-form-field">
          <label>New password</label>
          <input type="password" name="password" required />
        </div>
        <div class="modal-form-field">
          <label>Confirm password</label>
          <input type="password" name="password_confirm" required />
        </div>
      </form>
      <div class="modal-actions">
        <button type="button" class="btn ghost" id="password-cancel">Cancel</button>
        <button type="submit" class="btn" id="password-save" form="password-form">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openPasswordModal(user) {
  ensurePasswordModal();
  const modal = document.getElementById('password-modal');
  const form = document.getElementById('password-form');
  const cancel = document.getElementById('password-cancel');

  const close = () => {
    modal.classList.add('hidden');
    form.reset();
  };

  const onBackdrop = (event) => {
    if (event.target.matches('[data-password-close]')) close();
  };

  modal.addEventListener('click', onBackdrop, { once: true });
  cancel.addEventListener('click', close, { once: true });

  form.onsubmit = async (event) => {
    event.preventDefault();
    const password = form.password.value.trim();
    const confirm = form.password_confirm.value.trim();
    if (!password || !confirm) {
      alert('Enter and confirm the password.');
      return;
    }
    if (password !== confirm) {
      alert('Passwords do not match.');
      return;
    }
    try {
      await apiRequest(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          password,
          password_confirm: confirm,
        }),
      });
      close();
      if (window.showToast) window.showToast('Password updated');
    } catch (err) {
      alert(err.message);
    }
  };

  modal.classList.remove('hidden');
}

function ensureProfileMenu() {
  if (document.getElementById('profile-menu')) return;
  const menu = document.createElement('div');
  menu.id = 'profile-menu';
  menu.className = 'profile-menu hidden';
  menu.innerHTML = `
    <button type="button" class="profile-menu-item" data-profile-action="edit">Edit profile</button>
    <button type="button" class="profile-menu-item" data-profile-action="password">Change password</button>
  `;
  document.body.appendChild(menu);
}

function openProfileMenu(user, anchor) {
  ensureProfileMenu();
  const menu = document.getElementById('profile-menu');
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 8}px`;
  menu.style.right = `${Math.max(16, window.innerWidth - rect.right)}px`;
  menu.classList.remove('hidden');

  const onClick = (event) => {
    const button = event.target.closest('[data-profile-action]');
    if (button) {
      const action = button.dataset.profileAction;
      menu.classList.add('hidden');
      document.removeEventListener('click', onOutside);
      if (action === 'edit') {
        openProfileModal(window.currentUser || user);
      } else if (action === 'password') {
        openPasswordModal(window.currentUser || user);
      }
      return;
    }
  };

  const onOutside = (event) => {
    if (menu.contains(event.target) || anchor.contains(event.target)) return;
    menu.classList.add('hidden');
    document.removeEventListener('click', onOutside);
    menu.removeEventListener('click', onClick);
  };

  menu.addEventListener('click', onClick);
  setTimeout(() => document.addEventListener('click', onOutside), 0);
}
