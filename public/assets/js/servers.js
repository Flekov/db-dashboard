const serversTable = document.getElementById('servers-table');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('modal-form');
const modalCancel = document.getElementById('modal-cancel');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

const filterForm = document.getElementById('servers-filter-form');
const filterProjectSelect = document.getElementById('servers-filter-project');
const serverProjectSelect = document.getElementById('server-project-select');

let projects = [];

const serverFields = [
  { name: 'id', label: 'ID', readOnly: true },
  { name: 'project_id', label: 'Project', type: 'select' },
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
    if (field.type === 'select') {
      const options = projects.map((project) => {
        const selected = String(project.id) === String(item[field.name]) ? 'selected' : '';
        return `<option value="${project.id}" ${selected}>${escapeHtml(project.name)}</option>`;
      }).join('');
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
      if (field.name === 'project_id') {
        payload[field.name] = Number(value) || null;
        return;
      }
      payload[field.name] = field.name === 'port' ? Number(value) || 3306 : value;
    });

    try {
      await apiRequest(`/servers/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      closeModal();
      const projectId = filterProjectSelect && filterProjectSelect.value ? Number(filterProjectSelect.value) : null;
      await loadServers(projectId);
      if (window.showToast) window.showToast('Server saved');
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

async function loadServers(projectId = null) {
  const query = projectId ? `?project_id=${projectId}` : '';
  const data = await apiRequest(`/servers${query}`);
  const header = `
    <div class="table-row table-header">
      <div>ID</div>
      <div>Project</div>
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
        <div>${escapeHtml(item.project_name || '-')}</div>
        <div>${item.name}</div>
        <div>${item.host}:${item.port}</div>
        <div>${item.type}</div>
        <div>${item.version || '-'}</div>
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
    : '<div class="table-row table-empty"><div>No servers found.</div></div>';
  serversTable.innerHTML = header + rows + empty;

  if (!openedFromProject && Number.isFinite(initialItemId)) {
    const item = data.items.find((row) => Number(row.id) === initialItemId);
    if (item) {
      openModal(initialMode === 'edit' ? 'edit' : 'view', item);
      openedFromProject = true;
    }
  }
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
      const projectId = filterProjectSelect && filterProjectSelect.value ? Number(filterProjectSelect.value) : null;
      await loadServers(projectId);
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
  const filterOptions = ['<option value="">All projects</option>']
    .concat(projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`))
    .join('');
  if (filterProjectSelect) {
    filterProjectSelect.innerHTML = filterOptions;
  }
  if (serverProjectSelect) {
    serverProjectSelect.innerHTML = projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('');
  }
}

const params = new URLSearchParams(window.location.search);
const initialProjectId = Number.parseInt(params.get('project_id') || '', 10);
const initialItemId = Number.parseInt(params.get('id') || '', 10);
const initialMode = params.get('mode') || 'view';
let openedFromProject = false;

loadProjects().then(() => {
  if (Number.isFinite(initialProjectId)) {
    if (serverProjectSelect) {
      serverProjectSelect.value = String(initialProjectId);
    }
    if (filterProjectSelect) {
      filterProjectSelect.value = String(initialProjectId);
    }
    loadServers(initialProjectId);
    return;
  }
  loadServers();
});

const serverForm = document.getElementById('server-form');
serverForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    project_id: Number(form.project_id.value) || null,
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
    if (serverProjectSelect && serverProjectSelect.value) {
      await loadServers(Number(serverProjectSelect.value) || null);
    } else {
      await loadServers();
    }
    if (window.showToast) window.showToast('Server saved');
  } catch (err) {
    alert(err.message);
  }
});

if (filterForm) {
  filterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const projectId = Number(filterProjectSelect.value) || null;
    await loadServers(projectId);
  });
}
