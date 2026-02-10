const projectsTable = document.getElementById('projects-table');
const exportProjectsBtn = document.getElementById('export-projects');
const tagsRoot = document.getElementById('project-tags');
const filterForm = document.getElementById('projects-filter-form');
const filterTagsRoot = document.getElementById('projects-filter-tags');
let projectItems = [];
let tagItems = [];
let tagsInput = null;
let filterTagsInput = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTags() {
  if (tagsInput) tagsInput.setSuggestions(tagItems.map((tag) => tag.name));
  if (filterTagsInput) filterTagsInput.setSuggestions(tagItems.map((tag) => tag.name));
}

async function loadTags() {
  const data = await apiRequest('/tags').catch(() => ({ items: [] }));
  tagItems = data.items || [];
  renderTags();
}

async function loadProjects(tags = []) {
  const query = tags.length ? `?tags=${encodeURIComponent(tags.join(','))}` : '';
  const data = await apiRequest(`/projects${query}`);
  projectItems = data.items || [];
  if (exportProjectsBtn) {
    exportProjectsBtn.classList.toggle('hidden', projectItems.length === 0);
  }
  const header = `
    <div class="table-row table-header">
      <div>ID</div>
      <div>Code</div>
      <div>Name</div>
      <div>Version</div>
      <div>Type</div>
      <div>Actions</div>
    </div>
  `;
  const rows = data.items.map((item) => {
    const encoded = encodeURIComponent(JSON.stringify(item));
    return `
      <div class="table-row">
        <div>${item.id}</div>
        <div>${item.code}</div>
        <div>${item.name}</div>
        <div>${item.version || '-'}</div>
        <div>${item.type || '-'}</div>
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
    : '<div class="table-row table-empty"><div>No projects found.</div></div>';
  projectsTable.innerHTML = header + rows + empty;
}

if (exportProjectsBtn) {
  exportProjectsBtn.addEventListener('click', () => {
    if (!window.exportToCsv) return;
    window.exportToCsv('projects', [
      { key: 'id', label: 'ID' },
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'short_name', label: 'Short name' },
      { key: 'version', label: 'Version' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'owner_name', label: 'Owner name' },
      { key: 'owner_faculty_number', label: 'Owner faculty number' },
      { key: 'created_at', label: 'Created at' },
      { label: 'Participants', get: (row) => (row.participants_labels || []).join(', ') },
      { label: 'Tags', get: (row) => (row.tags || []).join(', ') },
    ], projectItems);
  });
}

projectsTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = JSON.parse(decodeURIComponent(button.dataset.row));

  if (button.dataset.action === 'delete') {
    const ok = confirm(`Delete project "${item.name}"?`);
    if (!ok) return;
    try {
      await apiRequest(`/projects/${item.id}`, { method: 'DELETE' });
      await loadProjects();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  const mode = button.dataset.action === 'edit' ? 'edit' : 'view';
  window.location.href = `project.html?id=${item.id}&mode=${mode}`;
});

tagsInput = window.createTagsInput ? window.createTagsInput(tagsRoot) : null;
filterTagsInput = window.createTagsInput ? window.createTagsInput(filterTagsRoot) : null;
Promise.all([loadTags(), loadProjects()]);

const projectForm = document.getElementById('project-form');
projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    code: form.code.value.trim(),
    name: form.name.value.trim(),
    short_name: form.short_name.value.trim(),
    version: form.version.value.trim(),
    type: form.type.value.trim(),
    tags: tagsInput ? tagsInput.getTags() : [],
  };

  try {
    await apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    form.reset();
    await loadProjects();
    if (window.showToast) window.showToast('Project saved');
  } catch (err) {
    alert(err.message);
  }
});

const bulkBtn = document.getElementById('bulk-import');
bulkBtn.addEventListener('click', async () => {
  const text = document.getElementById('bulk-input').value.trim();
  if (!text) return;

  try {
    const payload = JSON.parse(text);
    await apiRequest('/projects/import', {
      method: 'POST',
      body: JSON.stringify({ items: payload }),
    });
    await loadProjects();
    if (window.showToast) window.showToast('Projects imported');
  } catch (err) {
    alert(err.message || 'Invalid JSON');
  }
});

if (filterForm) {
  filterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await loadProjects(filterTagsInput ? filterTagsInput.getTags() : []);
  });
}
