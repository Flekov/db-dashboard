const recentProjects = document.getElementById('recent-projects');
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

function confirmDelete(message) {
  return new Promise((resolve) => {
    if (!confirmModal) {
      resolve(window.confirm(message));
      return;
    }
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
async function loadDashboard() {
  try {
    const [projects, servers, templates, backups] = await Promise.all([
      apiRequest('/projects').catch(() => ({ items: [] })),
      apiRequest('/servers').catch(() => ({ items: [] })),
      apiRequest('/templates').catch(() => ({ items: [] })),
      apiRequest('/backups').catch(() => ({ items: [] })),
    ]);

    const projectItems = projects.items || [];
    const serverItems = servers.items || [];
    const templateItems = templates.items || [];
    const backupItems = backups.items || [];

    document.getElementById('stat-projects').textContent = projectItems.length;
    document.getElementById('stat-servers').textContent = serverItems.length;
    document.getElementById('stat-templates').textContent = templateItems.length;
    document.getElementById('stat-backups').textContent = backupItems.length;

    const header = `
      <div class="table-row table-header">
        <div>Code</div>
        <div>Name</div>
        <div>Version</div>
        <div>Type</div>
        <div>Actions</div>
      </div>
    `;
    const rows = projectItems.slice(0, 5).map((item) => {
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
    const empty = projectItems.length
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

  const mode = button.dataset.action === 'edit' ? 'edit' : 'view';
  window.location.href = `project.html?id=${item.id}&mode=${mode}`;
});

loadDashboard();
