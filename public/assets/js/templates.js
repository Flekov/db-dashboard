const templatesTable = document.getElementById('templates-table');
const exportTemplatesBtn = document.getElementById('export-templates');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('modal-form');
const modalCancel = document.getElementById('modal-cancel');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmTitle = confirmModal ? confirmModal.querySelector('.modal-header h3') : null;

const filterForm = document.getElementById('templates-filter-form');
const filterProjectSelect = document.getElementById('templates-filter-project');
const templateProjectSelect = document.getElementById('template-project-select');

let projects = [];
let templateItems = [];

const templateFields = [
  { name: 'id', label: 'ID', readOnly: true },
  { name: 'project_id', label: 'Project', type: 'select' },
  { name: 'name', label: 'Name' },
  { name: 'db_type', label: 'DB type' },
  { name: 'db_version', label: 'DB version' },
  { name: 'stack_version', label: 'Stack version' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
  { name: 'body_json', label: 'Body JSON', type: 'textarea' },
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
    if (field.type === 'textarea') {
      return `
        <div class="modal-form-field">
          <label>${field.label}</label>
          <textarea name="${field.name}" rows="4" ${disabled}>${value}</textarea>
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
  modalTitle.textContent = mode === 'view' ? 'View template' : 'Edit template';
  renderForm(templateFields, item, mode);
  modal.classList.remove('hidden');

  modalForm.onsubmit = async (event) => {
    event.preventDefault();
    if (mode === 'view') return;

    const payload = {};
    templateFields.forEach((field) => {
      if (field.readOnly) return;
      payload[field.name] = modalForm.elements[field.name].value.trim();
    });

    let body = {};
    if (payload.body_json) {
      try {
        body = JSON.parse(payload.body_json);
      } catch (err) {
        alert('Invalid JSON in body');
        return;
      }
    }

    const updatePayload = {
      project_id: Number(payload.project_id) || null,
      name: payload.name,
      db_type: payload.db_type,
      db_version: payload.db_version,
      stack_version: payload.stack_version,
      notes: payload.notes,
      body,
    };

    try {
      await apiRequest(`/templates/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
      });
      closeModal();
      const projectId = filterProjectSelect && filterProjectSelect.value ? Number(filterProjectSelect.value) : null;
      await loadTemplates(projectId);
      if (window.showToast) window.showToast('Template saved');
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
    if (confirmTitle) confirmTitle.textContent = 'Confirm delete';
    confirmOk.textContent = 'Delete';
    confirmOk.classList.remove('success');
    confirmOk.classList.add('danger');
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

async function loadTemplates(projectId = null) {
  const query = projectId ? `?project_id=${projectId}` : '';
  const data = await apiRequest(`/templates${query}`);
  templateItems = data.items || [];
  if (exportTemplatesBtn) {
    exportTemplatesBtn.classList.toggle('hidden', templateItems.length === 0);
  }
  const header = `
    <div class="table-row table-header">
      <div>ID</div>
      <div>Project</div>
      <div>Name</div>
      <div>DB type</div>
      <div>DB version</div>
      <div>Status</div>
      <div>Actions</div>
    </div>
  `;
  const rows = data.items.map((item) => {
    const encoded = encodeURIComponent(JSON.stringify(item));
    const locked = Number(item.is_locked) === 1;
    return `
      <div class="table-row">
        <div>${item.id}</div>
        <div>${escapeHtml(item.project_name || '-')}</div>
        <div>${item.name}</div>
        <div>${item.db_type}</div>
        <div>${item.db_version || '-'}</div>
        <div>${locked ? 'Locked' : 'Draft'}</div>
        <div class="row-actions">
          ${locked ? '' : `<button class="btn ghost icon-btn" data-action="run" data-row="${encoded}" title="Run template" aria-label="Run template"><img src="${window.iconPaths?.play || ''}" alt="Run template" /></button>`}
          <button class="btn ghost icon-btn" data-action="view" data-row="${encoded}" title="View" aria-label="View"><img src="${window.iconPaths?.view || ''}" alt="View" /></button>
          ${locked ? '' : `<button class="btn icon-btn" data-action="edit" data-row="${encoded}" title="Edit" aria-label="Edit"><img src="${window.iconPaths?.edit || ''}" alt="Edit" /></button>`}
          ${locked ? '' : `<button class="btn danger icon-btn" data-action="delete" data-row="${encoded}" title="Delete" aria-label="Delete"><img src="${window.iconPaths?.delete || ''}" alt="Delete" /></button>`}
        </div>
      </div>
    `;
  }).join('');
  const empty = data.items.length
    ? ''
    : '<div class="table-row table-empty"><div>No templates found.</div></div>';
  templatesTable.innerHTML = header + rows + empty;

  if (!openedFromProject && Number.isFinite(initialItemId)) {
    const item = data.items.find((row) => Number(row.id) === initialItemId);
    if (item) {
      const locked = Number(item.is_locked) === 1;
      const mode = initialMode === 'edit' && !locked ? 'edit' : 'view';
      openModal(mode, item);
      openedFromProject = true;
    }
  }
}

if (exportTemplatesBtn) {
  exportTemplatesBtn.addEventListener('click', () => {
    if (!window.exportToCsv) return;
    window.exportToCsv('templates', [
      { key: 'id', label: 'ID' },
      { key: 'project_id', label: 'Project ID' },
      { key: 'project_name', label: 'Project' },
      { key: 'name', label: 'Name' },
      { key: 'db_type', label: 'DB type' },
      { key: 'db_version', label: 'DB version' },
      { key: 'stack_version', label: 'Stack version' },
      { key: 'notes', label: 'Notes' },
      { key: 'body_json', label: 'Body JSON' },
      { key: 'is_locked', label: 'Locked' },
      { key: 'locked_at', label: 'Locked at' },
      { key: 'last_run_at', label: 'Last run at' },
      { key: 'created_at', label: 'Created at' },
    ], templateItems);
  });
}

function confirmRun(message) {
  return new Promise((resolve) => {
    confirmMessage.textContent = message;
    if (confirmTitle) confirmTitle.textContent = 'Confirm run';
    confirmOk.textContent = 'Run';
    confirmOk.classList.remove('danger');
    confirmOk.classList.add('success');
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

templatesTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = JSON.parse(decodeURIComponent(button.dataset.row));

  if (button.dataset.action === 'run') {
    const ok = await confirmRun('Run this template? It will be locked after running.');
    if (!ok) return;
    try {
      await apiRequest(`/templates/${item.id}/run`, { method: 'POST' });
      const projectId = filterProjectSelect && filterProjectSelect.value ? Number(filterProjectSelect.value) : null;
      await loadTemplates(projectId);
      if (window.showToast) window.showToast('Template executed');
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  if (button.dataset.action === 'delete') {
    const ok = await confirmDelete(`Delete template "${item.name}"?`);
    if (!ok) return;
    try {
      await apiRequest(`/templates/${item.id}`, { method: 'DELETE' });
      const projectId = filterProjectSelect && filterProjectSelect.value ? Number(filterProjectSelect.value) : null;
      await loadTemplates(projectId);
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  const mode = button.dataset.action === 'edit' && Number(item.is_locked) !== 1 ? 'edit' : 'view';
  openModal(mode, item);
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
  if (templateProjectSelect) {
    templateProjectSelect.innerHTML = projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('');
  }
}

const params = new URLSearchParams(window.location.search);
const initialProjectId = Number.parseInt(params.get('project_id') || '', 10);
const initialItemId = Number.parseInt(params.get('id') || '', 10);
const initialMode = params.get('mode') || 'view';
let openedFromProject = false;

loadProjects().then(() => {
  if (Number.isFinite(initialProjectId)) {
    if (templateProjectSelect) {
      templateProjectSelect.value = String(initialProjectId);
    }
    if (filterProjectSelect) {
      filterProjectSelect.value = String(initialProjectId);
    }
    loadTemplates(initialProjectId);
    return;
  }
  loadTemplates();
});

const templateForm = document.getElementById('template-form');
templateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  let body = {};
  const bodyText = document.getElementById('template-body').value.trim();
  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch (err) {
      alert('Invalid JSON in the template body');
      return;
    }
  }

  const payload = {
    project_id: Number(form.project_id.value) || null,
    name: form.name.value.trim(),
    db_type: form.db_type.value.trim(),
    db_version: form.db_version.value.trim(),
    stack_version: form.stack_version.value.trim(),
    notes: form.notes.value.trim(),
    body,
  };

  try {
    await apiRequest('/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    form.reset();
    document.getElementById('template-body').value = '';
    if (templateProjectSelect && templateProjectSelect.value) {
      await loadTemplates(Number(templateProjectSelect.value) || null);
    } else {
      await loadTemplates();
    }
    if (window.showToast) window.showToast('Template saved');
  } catch (err) {
    alert(err.message);
  }
});

if (filterForm) {
  filterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const projectId = Number(filterProjectSelect.value) || null;
    await loadTemplates(projectId);
  });
}
