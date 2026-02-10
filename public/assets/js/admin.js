const adminPanel = document.getElementById('admin-panel');
const exportUsersBtn = document.getElementById('export-users');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('modal-form');
const modalCancel = document.getElementById('modal-cancel');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

const userFields = [
  { name: 'id', label: 'ID', readOnly: true },
  { name: 'name', label: 'Name' },
  { name: 'email', label: 'Email' },
  { name: 'faculty_number', label: 'Faculty number' },
  { name: 'role', label: 'Role', type: 'select', options: ['admin', 'user'] }
];

let userItems = [];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderForm(fields, item, mode) {
  const isView = mode === 'view';
  modal.classList.toggle('is-view', isView);

  modalForm.innerHTML = fields.map((field) => {
    const value = escapeHtml(item[field.name]);
    const disabled = isView || field.readOnly ? 'disabled' : '';
    if (field.type === 'select') {
      const options = field.options
        .map((option) => {
          const selected = option === item[field.name] ? 'selected' : '';
          return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`;
        })
        .join('');
      return `
        <div class="modal-form-field">
          <label>${field.label}</label>
          <select name="${field.name}" ${disabled}>${options}</select>
        </div>
      `;
    }
    return `
      <div class="modal-form-field">
        <label>${field.label}</label>
        <input type="text" name="${field.name}" value="${value}" ${disabled} />
      </div>
    `;
  }).join('');
}

function openModal(mode, item) {
  modalTitle.textContent = mode === 'view' ? 'View user' : 'Edit user';
  renderForm(userFields, item, mode);
  modal.classList.remove('hidden');

  modalForm.onsubmit = async (event) => {
    event.preventDefault();
    if (mode === 'view') return;

    const payload = {};
    userFields.forEach((field) => {
      if (field.readOnly) return;
      payload[field.name] = modalForm.elements[field.name].value.trim();
    });

    try {
      await apiRequest(`/users/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      closeModal();
      await loadAdmin();
      if (window.showToast) window.showToast('User saved');
    } catch (err) {
      alert(err.message);
    }
  };
}

function closeModal() {
  modal.classList.add('hidden');
  modal.classList.remove('is-view');
  modalForm.innerHTML = '';
}

function confirmDelete(message) {
  return new Promise((resolve) => {
    confirmMessage.textContent = message;
    confirmModal.classList.remove('hidden');

    const cleanup = () => {
      confirmModal.classList.add('hidden');
      confirmOk.removeEventListener('click', onOk);
      confirmCancel.removeEventListener('click', onCancel);
      confirmModal.removeEventListener('click', onBackdrop);
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onBackdrop = (event) => {
      if (event.target.matches('[data-confirm-close]')) {
        onCancel();
      }
    };

    confirmOk.addEventListener('click', onOk);
    confirmCancel.addEventListener('click', onCancel);
    confirmModal.addEventListener('click', onBackdrop);
  });
}

modal.addEventListener('click', (event) => {
  if (event.target.matches('[data-close]')) {
    closeModal();
  }
});

modalCancel.addEventListener('click', closeModal);

async function loadAdmin() {
  try {
    const me = await apiRequest('/auth/me');
    if (me.role !== 'admin') {
      adminPanel.innerHTML = '<div class="table-row table-empty"><div>Admin access required.</div></div>';
      return;
    }
    const data = await apiRequest('/users');
    userItems = data.items || [];
    if (exportUsersBtn) {
      exportUsersBtn.classList.toggle('hidden', userItems.length === 0);
    }
    const header = `
      <div class="table-row table-header">
        <div>Name</div>
        <div>Email</div>
        <div>Faculty</div>
        <div>Role</div>
        <div>Actions</div>
      </div>
    `;
    const rows = data.items.map((item) => {
      const encoded = encodeURIComponent(JSON.stringify(item));
      return `
        <div class="table-row">
          <div>${escapeHtml(item.name)}</div>
          <div>${escapeHtml(item.email)}</div>
          <div>${escapeHtml(item.faculty_number || '-')}</div>
          <div>${escapeHtml(item.role)}</div>
        <div class="row-actions">
          <button class="btn ghost icon-btn" data-action="view" data-row="${encoded}" title="View" aria-label="View"><img src="${window.iconPaths?.view || ''}" alt="View" /></button>
          <button class="btn icon-btn" data-action="edit" data-row="${encoded}" title="Edit" aria-label="Edit"><img src="${window.iconPaths?.edit || ''}" alt="Edit" /></button>
          <button class="btn danger icon-btn" data-action="delete" data-row="${encoded}" title="Delete" aria-label="Delete"><img src="${window.iconPaths?.delete || ''}" alt="Delete" /></button>
        </div>
        </div>
      `;
    }).join('');
    const empty = data.items.length
      ? ''
      : '<div class="table-row table-empty"><div>No users found.</div></div>';
    adminPanel.innerHTML = header + rows + empty;
  } catch (err) {
    const header = `
      <div class="table-row table-header">
        <div>Name</div>
        <div>Email</div>
        <div>Faculty</div>
        <div>Role</div>
        <div>Actions</div>
      </div>
    `;
    adminPanel.innerHTML = header + '<div class="table-row table-empty"><div>No data</div></div>';
    userItems = [];
    if (exportUsersBtn) {
      exportUsersBtn.classList.add('hidden');
    }
  }
}

if (exportUsersBtn) {
  exportUsersBtn.addEventListener('click', () => {
    if (!window.exportToCsv) return;
    window.exportToCsv('users', [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'faculty_number', label: 'Faculty number' },
      { key: 'role', label: 'Role' },
    ], userItems);
  });
}

adminPanel.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = JSON.parse(decodeURIComponent(button.dataset.row));

  if (button.dataset.action === 'delete') {
    const ok = await confirmDelete(`Delete user "${item.email}"?`);
    if (!ok) return;
    try {
      await apiRequest(`/users/${item.id}`, { method: 'DELETE' });
      await loadAdmin();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  openModal(button.dataset.action, item);
});

loadAdmin();
