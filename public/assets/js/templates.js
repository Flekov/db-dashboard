const templatesTable = document.getElementById('templates-table');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('modal-form');
const modalCancel = document.getElementById('modal-cancel');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

const templateFields = [
  { name: 'id', label: 'ID', readOnly: true },
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
      await loadTemplates();
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

async function loadTemplates() {
  const data = await apiRequest('/templates');
  templatesTable.innerHTML = data.items.map((item) => {
    const encoded = encodeURIComponent(JSON.stringify(item));
    return `
      <div class="table-row">
        <div>${item.id}</div>
        <div>${item.name}</div>
        <div>${item.db_type}</div>
        <div>${item.db_version || '-'}</div>
        <div class="row-actions">
          <button class="btn ghost" data-action="view" data-row="${encoded}">View</button>
          <button class="btn" data-action="edit" data-row="${encoded}">Edit</button>
          <button class="btn danger ghost" data-action="delete" data-row="${encoded}">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

templatesTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = JSON.parse(decodeURIComponent(button.dataset.row));

  if (button.dataset.action === 'delete') {
    const ok = await confirmDelete(`Delete template "${item.name}"?`);
    if (!ok) return;
    try {
      await apiRequest(`/templates/${item.id}`, { method: 'DELETE' });
      await loadTemplates();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  openModal(button.dataset.action, item);
});

loadTemplates();

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
    await loadTemplates();
  } catch (err) {
    alert(err.message);
  }
});
