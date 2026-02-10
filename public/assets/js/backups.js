const backupsTable = document.getElementById('backups-table');
const exportBackupsBtn = document.getElementById('export-backups');
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
const backupProjectSelect = document.getElementById('backup-project-select');

let projects = [];
let projectNameById = {};
let backupItems = [];

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
      if (window.showToast) window.showToast('Backup saved');
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

let currentProjectId = null;

async function loadBackups(projectId = currentProjectId) {
  const header = `
    <div class="table-row table-header">
      <div>ID</div>
      <div>Project</div>
      <div>Type</div>
      <div>Version</div>
      <div>Location</div>
      <div>Actions</div>
    </div>
  `;
  let data = null;
  if (Number.isFinite(projectId) && projectId > 0) {
    currentProjectId = projectId;
    data = await apiRequest(`/backups?project_id=${projectId}`).catch(() => ({ items: [] }));
  } else {
    currentProjectId = null;
    data = await apiRequest('/backups').catch(() => ({ items: [] }));
  }
  backupItems = data.items || [];
  if (exportBackupsBtn) {
    exportBackupsBtn.classList.toggle('hidden', backupItems.length === 0);
  }
  const rows = data.items.map((item) => {
    const encoded = encodeURIComponent(JSON.stringify(item));
    return `
      <div class="table-row">
        <div>${item.id}</div>
        <div>${escapeHtml(item.project_name || projectNameById[item.project_id] || '-')}</div>
        <div>${item.backup_type}</div>
        <div>${item.version_label || '-'}</div>
        <div>${item.location || '-'}</div>
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
    : '<div class="table-row table-empty"><div>No backups found.</div></div>';
  backupsTable.innerHTML = header + rows + empty;

  if (!openedFromProject && Number.isFinite(initialItemId)) {
    const item = data.items.find((row) => Number(row.id) === initialItemId);
    if (item) {
      openModal(initialMode === 'edit' ? 'edit' : 'view', item);
      openedFromProject = true;
    }
  }
}

if (exportBackupsBtn) {
  exportBackupsBtn.addEventListener('click', () => {
    if (!window.exportToCsv) return;
    window.exportToCsv('backups', [
      { key: 'id', label: 'ID' },
      { key: 'project_id', label: 'Project ID' },
      { label: 'Project', get: (row) => row.project_name || projectNameById[row.project_id] || '' },
      { key: 'backup_type', label: 'Type' },
      { key: 'version_label', label: 'Version' },
      { key: 'location', label: 'Location' },
      { key: 'created_at', label: 'Created at' },
    ], backupItems);
  });
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
      const projectId = filterProjectInput && filterProjectInput.value ? Number(filterProjectInput.value) : null;
      await loadBackups(projectId);
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  openModal(button.dataset.action, item);
});

async function loadProjects() {
  const data = await apiRequest('/projects');
  projects = data.items || [];
  projectNameById = projects.reduce((acc, project) => {
    acc[project.id] = project.name;
    return acc;
  }, {});
  const filterOptions = ['<option value="">All projects</option>']
    .concat(projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`))
    .join('');
  if (filterProjectInput) {
    filterProjectInput.innerHTML = filterOptions;
  }
  if (backupProjectSelect) {
    backupProjectSelect.innerHTML = projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('');
  }
}

const params = new URLSearchParams(window.location.search);
const initialProjectId = Number.parseInt(params.get('project_id') || '', 10);
const initialItemId = Number.parseInt(params.get('id') || '', 10);
const initialMode = params.get('mode') || 'view';
let openedFromProject = false;

loadProjects().then(() => {
  if (Number.isFinite(initialProjectId)) {
    if (filterProjectInput) {
      filterProjectInput.value = String(initialProjectId);
    }
    if (backupProjectSelect) {
      backupProjectSelect.value = String(initialProjectId);
    }
    loadBackups(initialProjectId);
    return;
  }
  loadBackups();
});

if (filterForm) {
  filterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const projectId = Number(filterProjectInput.value) || null;
    await loadBackups(projectId);
  });
}

const backupForm = document.getElementById('backup-form');
backupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const projectId = Number(form.project_id.value) || null;
  if (!projectId) {
    alert('Select a project for the backup.');
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
      filterProjectInput.value = String(projectId);
    }
    await loadBackups(projectId);
    if (window.showToast) window.showToast('Backup saved');
  } catch (err) {
    alert(err.message);
  }
});
