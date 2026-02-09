const projectsTable = document.getElementById('projects-table');
async function loadProjects() {
  const data = await apiRequest('/projects');
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

loadProjects();

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
