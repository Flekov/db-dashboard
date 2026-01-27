const recentProjects = document.getElementById('recent-projects');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('modal-form');
const modalCancel = document.getElementById('modal-cancel');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

const projectFields = [
  { name: 'id', label: 'ID', readOnly: true },
  { name: 'code', label: 'Code' },
  { name: 'name', label: 'Name' },
  { name: 'short_name', label: 'Short name' },
  { name: 'version', label: 'Version' },
  { name: 'type', label: 'Type' },
  { name: 'status', label: 'Status' },
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
  modalTitle.textContent = mode === 'view' ? 'View project' : 'Edit project';
  renderForm(projectFields, item, mode);
  modal.classList.remove('hidden');

  modalForm.onsubmit = async (event) => {
    event.preventDefault();
    if (mode === 'view') return;

    const payload = {};
    projectFields.forEach((field) => {
      if (field.readOnly) return;
      payload[field.name] = modalForm.elements[field.name].value.trim();
    });

    try {
      await apiRequest(`/projects/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      closeModal();
      await loadDashboard();
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

async function loadDashboard() {
  try {
    const [projects, templates, actions] = await Promise.all([
      apiRequest('/projects'),
      apiRequest('/templates'),
      apiRequest('/projects/1/actions').catch(() => ({ items: [] })),
    ]);

    document.getElementById('stat-projects').textContent = projects.items.length;
    document.getElementById('stat-templates').textContent = templates.items.length;
    document.getElementById('stat-actions').textContent = actions.items.length;

    recentProjects.innerHTML = projects.items.slice(0, 5).map((item) => {
      const encoded = encodeURIComponent(JSON.stringify(item));
      return `
        <div class="table-row">
          <div>${item.code}</div>
          <div>${item.name}</div>
          <div>${item.version || '-'}</div>
          <div>${item.type || '-'}</div>
          <div class="row-actions">
            <button class="btn ghost" data-action="view" data-row="${encoded}">View</button>
            <button class="btn" data-action="edit" data-row="${encoded}">Edit</button>
            <button class="btn danger ghost" data-action="delete" data-row="${encoded}">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

recentProjects.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = JSON.parse(decodeURIComponent(button.dataset.row));

  if (button.dataset.action === 'delete') {
    const ok = await confirmDelete(`Delete project "${item.name}"?`);
    if (!ok) return;
    try {
      await apiRequest(`/projects/${item.id}`, { method: 'DELETE' });
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  openModal(button.dataset.action, item);
});

loadDashboard();
