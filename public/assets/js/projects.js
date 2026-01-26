const projectsTable = document.getElementById('projects-table');

async function loadProjects() {
  const data = await apiRequest('/projects');
  projectsTable.innerHTML = data.items.map((item) => `
    <div class="table-row">
      <div>${item.id}</div>
      <div>${item.code}</div>
      <div>${item.name}</div>
      <div>${item.version || '-'}</div>
      <div>${item.type || '-'}</div>
    </div>
  `).join('');
}

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
  } catch (err) {
    alert(err.message || 'Invalid JSON');
  }
});
