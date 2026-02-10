const projectForm = document.getElementById('project-form');
const projectTitle = document.getElementById('project-title');
const ownerSelect = document.getElementById('owner-select');
const tagsRoot = document.getElementById('project-tags');
const switchModeBtn = document.getElementById('switch-mode');
const backBtn = document.getElementById('back-to-projects');
const deleteProjectBtn = document.getElementById('delete-project');
const addParticipantForm = document.getElementById('add-participant-form');
const addParticipantSelect = document.getElementById('add-participant-select');
const participantsTable = document.getElementById('participants-table');
const saveBtn = document.getElementById('save-project');
const templateTable = document.getElementById('template-table');
const serversTable = document.getElementById('servers-table');
const backupsTable = document.getElementById('backups-table');
const newTemplateBtn = document.getElementById('new-template-btn');
const newServerBtn = document.getElementById('new-server-btn');
const newBackupBtn = document.getElementById('new-backup-btn');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmTitle = confirmModal ? confirmModal.querySelector('.modal-header h3') : null;
const itemModal = document.getElementById('item-modal');
const itemModalTitle = document.getElementById('item-modal-title');
const itemModalForm = document.getElementById('item-modal-form');
const itemModalCancel = document.getElementById('item-modal-cancel');

let projectId = null;
let mode = 'view';
let users = [];
let participants = [];
let ownerId = null;
let templates = [];
let servers = [];
let backups = [];
let currentProject = null;
let tagItems = [];
let tagsInput = null;

function downloadServerJson(item) {
  const payload = {
    host: item.host || '',
    port: Number(item.port) || 3306,
    name: item.name || '',
    user: item.db_user || '',
    pass: item.db_pass || '',
    charset: item.charset || '',
  };
  const fileBase = String(item.name || 'server').replace(/[^A-Za-z0-9-_]/g, '_');
  const fileName = `${fileBase || 'server'}_${item.id || 'export'}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

const itemFields = {
  template: [
    { name: 'name', label: 'Name' },
    { name: 'db_type', label: 'DB type' },
    { name: 'db_version', label: 'DB version' },
    { name: 'stack_version', label: 'Stack version' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
    { name: 'body_json', label: 'Body JSON', type: 'textarea' },
  ],
  server: [
    { name: 'name', label: 'DB name' },
    { name: 'host', label: 'Host' },
    { name: 'port', label: 'Port' },
    { name: 'type', label: 'Type' },
    { name: 'version', label: 'Version' },
    { name: 'db_user', label: 'User' },
    { name: 'db_pass', label: 'Password' },
    { name: 'charset', label: 'Charset' },
  ],
  backup: [
    { name: 'backup_type', label: 'Type' },
    { name: 'location', label: 'Location' },
    { name: 'version_label', label: 'Version label' },
  ],
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: parseInt(params.get('id'), 10),
    mode: params.get('mode') || 'view',
  };
}

function setMode(nextMode) {
  mode = nextMode === 'edit' ? 'edit' : 'view';
  const isEdit = mode === 'edit';
  projectForm.querySelectorAll('input, select').forEach((el) => {
    if (el.name === 'status' || el.name === 'owner_email' || el.name === 'code' || el.name === 'name' || el.name === 'short_name' || el.name === 'version' || el.name === 'type') {
      el.disabled = !isEdit;
    }
  });
  if (tagsInput) {
    tagsInput.setDisabled(!isEdit);
  }
  saveBtn.classList.toggle('hidden', !isEdit);
  addParticipantForm.classList.toggle('hidden', !isEdit);
  newTemplateBtn.classList.toggle('hidden', !isEdit);
  newServerBtn.classList.toggle('hidden', !isEdit);
  newBackupBtn.classList.toggle('hidden', !isEdit);
  deleteProjectBtn.classList.toggle('hidden', !isEdit);
  switchModeBtn.textContent = isEdit ? 'View' : 'Edit';
}

function confirmAction(message) {
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


function closeItemModal() {
  itemModal.classList.add('hidden');
  itemModal.classList.remove('is-view');
  itemModalForm.innerHTML = '';
}

function renderItemForm(type, item, mode) {
  const fields = itemFields[type] || [];
  const isView = mode === 'view';
  itemModal.classList.toggle('is-view', isView);
  itemModalForm.innerHTML = fields.map((field) => {
    const value = escapeHtml(item[field.name] ?? '');
    const disabled = isView ? 'disabled' : '';
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

function openItemModal(type, mode, item = {}) {
  itemModalTitle.textContent = `${mode === 'edit' ? 'Edit' : 'View'} ${type}`;
  renderItemForm(type, item, mode);
  itemModal.classList.remove('hidden');

  itemModalForm.onsubmit = async (event) => {
    event.preventDefault();
    if (mode === 'view') return;
    const fields = itemFields[type] || [];
    const payload = {};
    fields.forEach((field) => {
      const value = itemModalForm.elements[field.name].value.trim();
      payload[field.name] = value;
    });

    try {
      if (type === 'template') {
        let body = {};
        if (payload.body_json) {
          body = JSON.parse(payload.body_json);
        }
        const templatePayload = {
          project_id: projectId,
          name: payload.name,
          db_type: payload.db_type,
          db_version: payload.db_version,
          stack_version: payload.stack_version,
          notes: payload.notes,
          body,
        };
        if (item.id) {
          await apiRequest(`/templates/${item.id}`, { method: 'PUT', body: JSON.stringify(templatePayload) });
        } else {
          await apiRequest('/templates', { method: 'POST', body: JSON.stringify(templatePayload) });
        }
        await loadTemplate();
        if (window.showToast) window.showToast('Template saved');
      } else if (type === 'server') {
        const serverPayload = {
          project_id: projectId,
          name: payload.name,
          host: payload.host,
          port: Number(payload.port) || 3306,
          type: payload.type,
          version: payload.version,
          db_user: payload.db_user,
          db_pass: payload.db_pass,
          charset: payload.charset,
        };
        if (item.id) {
          await apiRequest(`/servers/${item.id}`, { method: 'PUT', body: JSON.stringify(serverPayload) });
        } else {
          await apiRequest('/servers', { method: 'POST', body: JSON.stringify(serverPayload) });
        }
        await loadServers();
        if (window.showToast) window.showToast('Server saved');
      } else if (type === 'backup') {
        const backupPayload = {
          backup_type: payload.backup_type,
          location: payload.location,
          version_label: payload.version_label,
        };
        if (item.id) {
          await apiRequest(`/projects/${projectId}/backups/${item.id}`, { method: 'PUT', body: JSON.stringify(backupPayload) });
        } else {
          await apiRequest(`/projects/${projectId}/backups`, { method: 'POST', body: JSON.stringify(backupPayload) });
        }
        await loadBackups();
        if (window.showToast) window.showToast('Backup saved');
      }
      closeItemModal();
    } catch (err) {
      if (window.showToast) {
        const message = /path/i.test(err.message || '') ? 'Path not found' : (err.message || 'Backup failed');
        window.showToast(message, 'error');
      } else {
        alert(err.message);
      }
    }
  };
}

itemModal.addEventListener('click', (event) => {
  if (event.target.matches('[data-item-close]')) {
    closeItemModal();
  }
});

itemModalCancel.addEventListener('click', closeItemModal);

async function loadUsers() {
  const data = await apiRequest('/users');
  users = data.items || [];
  const ownerOptions = users.map((user) => `<option value="${escapeHtml(user.email)}">${escapeHtml(user.name)}</option>`).join('');
  ownerSelect.innerHTML = ownerOptions;
}

async function loadTags() {
  const data = await apiRequest('/tags').catch(() => ({ items: [] }));
  tagItems = data.items || [];
  if (tagsInput) {
    tagsInput.setSuggestions(tagItems.map((tag) => tag.name));
  }
}

function renderParticipants() {
  const header = `
    <div class="table-row table-header">
      <div>Name</div>
      <div>Role</div>
      <div>Actions</div>
    </div>
  `;
  const rows = participants.map((item) => {
    const removeBtn = item.role === 'owner' ? '' : `<button class="btn danger ghost" data-user="${item.id}">Remove</button>`;
    return `
      <div class="table-row">
        <div>${escapeHtml(item.name)}</div>
        <div>${escapeHtml(item.role)}</div>
        <div class="row-actions">${mode === 'edit' ? removeBtn : ''}</div>
      </div>
    `;
  }).join('');
  const empty = participants.length
    ? ''
    : '<div class="table-row table-empty"><div>No participants found.</div></div>';
  participantsTable.innerHTML = header + rows + empty;
}

function renderTemplate() {
  const showActions = mode === 'edit';
  const header = `
    <div class="table-row table-header">
      <div>Name</div>
      <div>DB type</div>
      <div>DB version</div>
      <div>Stack</div>
      <div>Status</div>
      <div>Actions</div>
    </div>
  `;
  const rows = templates.map((item) => `
    <div class="table-row">
      <div>${escapeHtml(item.name)}</div>
      <div>${escapeHtml(item.db_type)}</div>
      <div>${escapeHtml(item.db_version || '-')}</div>
      <div>${escapeHtml(item.stack_version || '-')}</div>
      <div>${Number(item.is_locked) === 1 ? 'Locked' : 'Draft'}</div>
      <div class="row-actions">
        ${showActions && Number(item.is_locked) !== 1 ? `<button class="btn ghost icon-btn" data-action="run" data-type="template" data-id="${item.id}" title="Run template" aria-label="Run template"><img src="${window.iconPaths?.play || ''}" alt="Run template" /></button>` : ''}
        <button class="btn ghost icon-btn" data-action="view" data-type="template" data-id="${item.id}" title="View" aria-label="View"><img src="${window.iconPaths?.view || ''}" alt="View" /></button>
        ${showActions && Number(item.is_locked) !== 1 ? `<button class="btn icon-btn" data-action="edit" data-type="template" data-id="${item.id}" title="Edit" aria-label="Edit"><img src="${window.iconPaths?.edit || ''}" alt="Edit" /></button>` : ''}
        ${showActions && Number(item.is_locked) !== 1 ? `<button class="btn danger icon-btn" data-action="delete" data-type="template" data-id="${item.id}" title="Delete" aria-label="Delete"><img src="${window.iconPaths?.delete || ''}" alt="Delete" /></button>` : ''}
      </div>
    </div>
  `).join('');
  const empty = templates.length
    ? ''
    : '<div class="table-row table-empty"><div>No templates for this project.</div></div>';
  templateTable.innerHTML = header + rows + empty;
}

function renderServers() {
  const showActions = mode === 'edit';
  const header = `
    <div class="table-row table-header">
      <div>DB name</div>
      <div>Host</div>
      <div>User</div>
      <div>Charset</div>
      <div>Actions</div>
    </div>
  `;
  const rows = servers.map((item) => `
    <div class="table-row">
      <div>${escapeHtml(item.name)}</div>
      <div>${escapeHtml(item.host)}:${escapeHtml(item.port)}</div>
      <div>${escapeHtml(item.db_user || '-')}</div>
      <div>${escapeHtml(item.charset || '-')}</div>
      <div class="row-actions">
        <button class="btn ghost icon-btn" data-action="view" data-type="server" data-id="${item.id}" title="View" aria-label="View"><img src="${window.iconPaths?.view || ''}" alt="View" /></button>
        ${showActions ? `<button class="btn icon-btn" data-action="edit" data-type="server" data-id="${item.id}" title="Edit" aria-label="Edit"><img src="${window.iconPaths?.edit || ''}" alt="Edit" /></button>` : ''}
        <button class="btn ghost icon-btn" data-action="export" data-type="server" data-id="${item.id}" title="Export JSON" aria-label="Export JSON"><img src="${window.iconPaths?.download || ''}" alt="Export JSON" /></button>
        ${showActions ? `<button class="btn danger icon-btn" data-action="delete" data-type="server" data-id="${item.id}" title="Delete" aria-label="Delete"><img src="${window.iconPaths?.delete || ''}" alt="Delete" /></button>` : ''}
      </div>
    </div>
  `).join('');
  const empty = servers.length
    ? ''
    : '<div class="table-row table-empty"><div>No servers for this project.</div></div>';
  serversTable.innerHTML = header + rows + empty;
}

function renderBackups() {
  const showActions = mode === 'edit';
  const header = `
    <div class="table-row table-header">
      <div>ID</div>
      <div>Type</div>
      <div>Version</div>
      <div>Created</div>
      <div>Actions</div>
    </div>
  `;
  const rows = backups.map((item) => `
    <div class="table-row">
      <div>${escapeHtml(item.id)}</div>
      <div>${escapeHtml(item.backup_type)}</div>
      <div>${escapeHtml(item.version_label || '-')}</div>
      <div>${escapeHtml(item.created_at || '-')}</div>
      <div class="row-actions">
        <button class="btn ghost icon-btn" data-action="view" data-type="backup" data-id="${item.id}" title="View" aria-label="View"><img src="${window.iconPaths?.view || ''}" alt="View" /></button>
        ${showActions ? `<button class="btn icon-btn" data-action="edit" data-type="backup" data-id="${item.id}" title="Edit" aria-label="Edit"><img src="${window.iconPaths?.edit || ''}" alt="Edit" /></button>` : ''}
        ${showActions ? `<button class="btn danger icon-btn" data-action="delete" data-type="backup" data-id="${item.id}" title="Delete" aria-label="Delete"><img src="${window.iconPaths?.delete || ''}" alt="Delete" /></button>` : ''}
      </div>
    </div>
  `).join('');
  const empty = backups.length
    ? ''
    : '<div class="table-row table-empty"><div>No backups for this project.</div></div>';
  backupsTable.innerHTML = header + rows + empty;
}

function refreshAddOptions() {
  const existing = new Set(participants.map((p) => p.id));
  const available = users.filter((user) => !existing.has(user.id));
  const options = available.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)}</option>`).join('');
  addParticipantSelect.innerHTML = options;
  addParticipantSelect.disabled = available.length === 0;
}

async function loadParticipants() {
  const data = await apiRequest(`/projects/${projectId}/participants`);
  participants = data.items || [];
  ownerId = data.owner_id;
  renderParticipants();
  refreshAddOptions();
}

async function loadTemplate() {
  const data = await apiRequest(`/templates?project_id=${projectId}`).catch(() => ({ items: [] }));
  templates = data.items || [];
  renderTemplate();
}

async function loadServers() {
  const data = await apiRequest(`/servers?project_id=${projectId}`).catch(() => ({ items: [] }));
  servers = data.items || [];
  renderServers();
}

async function loadBackups() {
  const data = await apiRequest(`/projects/${projectId}/backups`).catch(() => ({ items: [] }));
  backups = data.items || [];
  renderBackups();
}

async function loadProject() {
  const data = await apiRequest(`/projects/${projectId}`);
  currentProject = data.item;
  projectTitle.textContent = currentProject.name || `Project #${projectId}`;
  projectForm.code.value = currentProject.code || '';
  projectForm.name.value = currentProject.name || '';
  projectForm.short_name.value = currentProject.short_name || '';
  projectForm.version.value = currentProject.version || '';
  projectForm.type.value = currentProject.type || '';
  projectForm.status.value = currentProject.status || '';
  ownerSelect.value = currentProject.owner_email || '';
  if (tagsInput && Array.isArray(currentProject.tags)) {
    tagsInput.setTags(currentProject.tags);
  }
}

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (mode !== 'edit') return;
  const payload = {
    code: projectForm.code.value.trim(),
    name: projectForm.name.value.trim(),
    short_name: projectForm.short_name.value.trim(),
    version: projectForm.version.value.trim(),
    type: projectForm.type.value.trim(),
    status: projectForm.status.value.trim() || 'active',
    owner_email: ownerSelect.value,
    tags: tagsInput ? tagsInput.getTags() : [],
  };
  try {
    await apiRequest(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await loadProject();
    if (window.showToast) window.showToast('Project saved');
  } catch (err) {
    alert(err.message);
  }
});

addParticipantForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (mode !== 'edit') return;
  const userId = parseInt(addParticipantSelect.value, 10);
  if (!userId) return;
  try {
    await apiRequest(`/projects/${projectId}/participants`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
    await loadParticipants();
  } catch (err) {
    alert(err.message);
  }
});

participantsTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-user]');
  if (!button || mode !== 'edit') return;
  const userId = parseInt(button.dataset.user, 10);
  if (!userId || userId === ownerId) return;
  const ok = await confirmAction('Remove this participant from the project?');
  if (!ok) return;
  try {
    await apiRequest(`/projects/${projectId}/participants/${userId}`, { method: 'DELETE' });
    await loadParticipants();
  } catch (err) {
    alert(err.message);
  }
});

switchModeBtn.addEventListener('click', () => {
  const nextMode = mode === 'edit' ? 'view' : 'edit';
  const params = new URLSearchParams(window.location.search);
  params.set('mode', nextMode);
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  setMode(nextMode);
  renderParticipants();
  renderTemplate();
  renderServers();
  renderBackups();
});

backBtn.addEventListener('click', () => {
  window.location.href = 'projects.html';
});

deleteProjectBtn.addEventListener('click', async () => {
  if (mode !== 'edit') return;
  const ok = await confirmAction(`Delete project "${currentProject?.name || projectId}"?`);
  if (!ok) return;
  try {
    await apiRequest(`/projects/${projectId}`, { method: 'DELETE' });
    window.location.href = 'projects.html';
  } catch (err) {
    alert(err.message);
  }
});

newTemplateBtn.addEventListener('click', () => {
  openItemModal('template', 'edit', {});
});

newServerBtn.addEventListener('click', () => {
  openItemModal('server', 'edit', {});
});

newBackupBtn.addEventListener('click', () => {
  openItemModal('backup', 'edit', {});
});

async function handleTableAction(event, type) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const itemId = Number(button.dataset.id);
  if (!itemId) return;

  if (action === 'run' && type === 'template' && mode === 'edit') {
    const item = templates.find((row) => Number(row.id) === itemId);
    if (!item || Number(item.is_locked) === 1) return;
    const ok = await confirmRun('Run this template? It will be locked after running.');
    if (!ok) return;
    try {
      await apiRequest(`/templates/${item.id}/run`, { method: 'POST' });
      await loadTemplate();
      if (window.showToast) window.showToast('Template executed');
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  if (action === 'delete' && mode === 'edit') {
    const ok = await confirmAction('Delete this item?');
    if (!ok) return;
    const deleteMap = {
      template: `/templates/${itemId}`,
      server: `/servers/${itemId}`,
      backup: `/projects/${projectId}/backups/${itemId}`,
    };
    try {
      await apiRequest(deleteMap[type], { method: 'DELETE' });
      if (type === 'template') await loadTemplate();
      else if (type === 'server') await loadServers();
      else await loadBackups();
    } catch (err) {
      alert(err.message);
    }
    return;
  }
  const collection = type === 'template' ? templates : type === 'server' ? servers : backups;
  const item = collection.find((row) => Number(row.id) === itemId);
  if (!item) return;
  if (action === 'export' && type === 'server') {
    downloadServerJson(item);
    return;
  }
  const lockedTemplate = type === 'template' && Number(item.is_locked) === 1;
  const modeToUse = action === 'edit' && !lockedTemplate ? 'edit' : 'view';
  openItemModal(type, modeToUse, item);
}

templateTable.addEventListener('click', (event) => handleTableAction(event, 'template'));
serversTable.addEventListener('click', (event) => handleTableAction(event, 'server'));
backupsTable.addEventListener('click', (event) => handleTableAction(event, 'backup'));

async function init() {
  const params = getParams();
  projectId = params.id;
  if (!projectId) {
    window.location.href = 'projects.html';
    return;
  }
  setMode(params.mode);
  tagsInput = window.createTagsInput ? window.createTagsInput(tagsRoot) : null;
  await loadUsers();
  await loadTags();
  await loadProject();
  await loadParticipants();
  await loadTemplate();
  await loadServers();
  await loadBackups();
  renderParticipants();
  renderTemplate();
  renderServers();
  renderBackups();
}

init().catch((err) => {
  console.error(err);
  alert('Failed to load project.');
});
