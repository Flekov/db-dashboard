const backupsTable = document.getElementById('backups-table');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('modal-form');
const modalCancel = document.getElementById('modal-cancel');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

const filterForm = document.getElementById('backups-filter-form');
const filterProjectInput = document.getElementById('backups-filter-project');

const backupFields = [
  { name: 'id', label: 'ID', readOnly: true },
  { name: 'project_id', label: 'Project ID', readOnly: true },
  { name: 'backup_type', label: 'Type' },
  { name: 'location', label: 'Location' },
  { name: 'version_label', label: 'Version label' },
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
  modalTitle.textContent = mode === 'view' ? 'View backup' : 'Edit backup';
  renderForm(backupFields, item, mode);
  modal.classList.remove('hidden');

  modalForm.onsubmit = async (event) => {
    event.preventDefault();
    if (mode === 'view') return;

    const payload = {};
    backupFields.forEach((field) => {
      if (field.readOnly) return;
      payload[field.name] = modalForm.elements[field.name].value.trim();
    });

    try {
      await apiRequest(`/projects/${item.project_id}/backups/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      closeModal();
      await loadBackups();
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

let currentProjectId = 1;

function normalizeProjectId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function loadBackups(projectId = currentProjectId) {
  const header = `
    <div class="table-row table-header">
      <div>ID</div>
      <div>Project ID</div>
      <div>Type</div>
      <div>Version</div>
      <div>Location</div>
      <div>Actions</div>
    </div>
  `;
  if (!Number.isFinite(projectId) || projectId <= 0) {
    backupsTable.innerHTML = header + '<div class="table-row table-empty"><div>Enter a project id to load backups.</div></div>';
    return;
  }
  currentProjectId = projectId;
  const data = await apiRequest(`/projects/${projectId}/backups`).catch(() => ({ items: [] }));
  const rows = data.items.map((item) => {
    const encoded = encodeURIComponent(JSON.stringify(item));
    return `
      <div class="table-row">
        <div>${item.id}</div>
        <div>${item.project_id}</div>
        <div>${item.backup_type}</div>
        <div>${item.version_label || '-'}</div>
        <div>${item.location || '-'}</div>
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
    : '<div class="table-row table-empty"><div>No backups found.</div></div>';
  backupsTable.innerHTML = header + rows + empty;
}

backupsTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = JSON.parse(decodeURIComponent(button.dataset.row));

  if (button.dataset.action === 'delete') {
    const ok = await confirmDelete(`Delete backup ${item.id}?`);
    if (!ok) return;
    try {
      await apiRequest(`/projects/${item.project_id}/backups/${item.id}`, { method: 'DELETE' });
      await loadBackups();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  openModal(button.dataset.action, item);
});

if (filterProjectInput) {
  const initialProjectId = normalizeProjectId(filterProjectInput.value) ?? currentProjectId;
  currentProjectId = initialProjectId;
  filterProjectInput.value = currentProjectId;
}

loadBackups(currentProjectId);

if (filterForm) {
  filterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nextProjectId = normalizeProjectId(filterProjectInput.value);
    if (!nextProjectId) {
      alert('Enter a valid project id to filter backups.');
      return;
    }
    await loadBackups(nextProjectId);
  });
}

const backupForm = document.getElementById('backup-form');
backupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const projectId = normalizeProjectId(form.project_id.value);
  if (!projectId) {
    alert('Enter a valid project id for the backup.');
    return;
  }

  const payload = {
    backup_type: form.backup_type.value.trim(),
    location: form.location.value.trim(),
    version_label: form.version_label.value.trim(),
  };

  try {
    await apiRequest(`/projects/${projectId}/backups`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    form.reset();
    if (filterProjectInput) {
      filterProjectInput.value = projectId;
    }
    await loadBackups(projectId);
  } catch (err) {
    alert(err.message);
  }
});
