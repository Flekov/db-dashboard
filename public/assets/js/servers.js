const serversTable = document.getElementById('servers-table');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('modal-form');
const modalCancel = document.getElementById('modal-cancel');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

const serverFields = [
  { name: 'id', label: 'ID', readOnly: true },
  { name: 'name', label: 'Name' },
  { name: 'host', label: 'Host' },
  { name: 'port', label: 'Port' },
  { name: 'type', label: 'Type' },
  { name: 'version', label: 'Version' },
  { name: 'root_user', label: 'Root user' },
  { name: 'created_at', label: 'Created at', readOnly: true }
];

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
    return `
      <div class="modal-form-field">
        <label>${field.label}</label>
        <input type="text" name="${field.name}" value="${value}" ${disabled} />
      </div>
    `;
  }).join('');
}

function openModal(mode, item) {
  modalTitle.textContent = mode === 'view' ? 'View server' : 'Edit server';
  renderForm(serverFields, item, mode);
  modal.classList.remove('hidden');

  modalForm.onsubmit = async (event) => {
    event.preventDefault();
    if (mode === 'view') return;

    const payload = {};
    serverFields.forEach((field) => {
      if (field.readOnly) return;
      const value = modalForm.elements[field.name].value.trim();
      payload[field.name] = field.name === 'port' ? Number(value) || 3306 : value;
    });

    try {
      await apiRequest(`/servers/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      closeModal();
      await loadServers();
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

async function loadServers() {
  const data = await apiRequest('/servers');
  const header = `
    <div class="table-row table-header">
      <div>ID</div>
      <div>Name</div>
      <div>Host</div>
      <div>Type</div>
      <div>Version</div>
      <div>Actions</div>
    </div>
  `;
  const rows = data.items.map((item) => {
    const encoded = encodeURIComponent(JSON.stringify(item));
    return `
      <div class="table-row">
        <div>${item.id}</div>
        <div>${item.name}</div>
        <div>${item.host}:${item.port}</div>
        <div>${item.type}</div>
        <div>${item.version || '-'}</div>
        <div class="row-actions">
          <button class="btn ghost" data-action="view" data-row="${encoded}">View</button>
          <button class="btn" data-action="edit" data-row="${encoded}">Edit</button>
          <button class="btn danger ghost" data-action="delete" data-row="${encoded}">Delete</button>
        </div>
      </div>
    `;
  }).join('');
  const empty = data.items.length
    ? ''
    : '<div class="table-row table-empty"><div>No servers found.</div></div>';
  serversTable.innerHTML = header + rows + empty;
}

serversTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = JSON.parse(decodeURIComponent(button.dataset.row));

  if (button.dataset.action === 'delete') {
    const ok = await confirmDelete(`Delete server "${item.name}"?`);
    if (!ok) return;
    try {
      await apiRequest(`/servers/${item.id}`, { method: 'DELETE' });
      await loadServers();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  openModal(button.dataset.action, item);
});

loadServers();

const serverForm = document.getElementById('server-form');
serverForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    name: form.name.value.trim(),
    host: form.host.value.trim(),
    port: Number(form.port.value) || 3306,
    type: form.type.value.trim(),
    version: form.version.value.trim(),
    root_user: form.root_user.value.trim(),
  };

  try {
    await apiRequest('/servers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    form.reset();
    await loadServers();
  } catch (err) {
    alert(err.message);
  }
});
