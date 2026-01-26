const backupsTable = document.getElementById('backups-table');

async function loadBackups() {
  const data = await apiRequest('/projects/1/backups').catch(() => ({ items: [] }));
  backupsTable.innerHTML = data.items.map((item) => `
    <div class="table-row">
      <div>${item.id}</div>
      <div>${item.project_id}</div>
      <div>${item.backup_type}</div>
      <div>${item.version_label || '-'}</div>
      <div>${item.location || '-'}</div>
    </div>
  `).join('');
}

loadBackups();

const backupForm = document.getElementById('backup-form');
backupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const projectId = form.project_id.value.trim();

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
    await loadBackups();
  } catch (err) {
    alert(err.message);
  }
});
