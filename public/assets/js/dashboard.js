const recentProjects = document.getElementById('recent-projects');
async function loadDashboard() {
  try {
    const [projects, servers, templates, backups] = await Promise.all([
      apiRequest('/projects'),
      apiRequest('/servers'),
      apiRequest('/templates'),
      apiRequest('/backups').catch(() => ({ items: [] })),
    ]);

    document.getElementById('stat-projects').textContent = projects.items.length;
    document.getElementById('stat-servers').textContent = servers.items.length;
    document.getElementById('stat-templates').textContent = templates.items.length;
    document.getElementById('stat-backups').textContent = backups.items.length;

    const header = `
      <div class="table-row table-header">
        <div>Code</div>
        <div>Name</div>
        <div>Version</div>
        <div>Type</div>
        <div>Actions</div>
      </div>
    `;
    const rows = projects.items.slice(0, 5).map((item) => {
      const encoded = encodeURIComponent(JSON.stringify(item));
      return `
        <div class="table-row">
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
    const empty = projects.items.length
      ? ''
      : '<div class="table-row table-empty"><div>No projects found.</div></div>';
    recentProjects.innerHTML = header + rows + empty;
  } catch (err) {
    console.error(err);
  }
}

recentProjects.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = JSON.parse(decodeURIComponent(button.dataset.row));

  if (button.dataset.action === 'delete') {
    const ok = confirm(`Delete project "${item.name}"?`);
    if (!ok) return;
    try {
      await apiRequest(`/projects/${item.id}`, { method: 'DELETE' });
      await loadDashboard();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  const mode = button.dataset.action === 'edit' ? 'edit' : 'view';
  window.location.href = `project.html?id=${item.id}&mode=${mode}`;
});

loadDashboard();
