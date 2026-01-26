const templatesTable = document.getElementById('templates-table');

async function loadTemplates() {
  const data = await apiRequest('/templates');
  templatesTable.innerHTML = data.items.map((item) => `
    <div class="table-row">
      <div>${item.id}</div>
      <div>${item.name}</div>
      <div>${item.db_type}</div>
      <div>${item.db_version || '-'}</div>
    </div>
  `).join('');
}

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
