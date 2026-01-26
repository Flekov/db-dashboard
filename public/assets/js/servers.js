const serversTable = document.getElementById('servers-table');

async function loadServers() {
  const data = await apiRequest('/servers');
  serversTable.innerHTML = data.items.map((item) => `
    <div class="table-row">
      <div>${item.id}</div>
      <div>${item.name}</div>
      <div>${item.host}:${item.port}</div>
      <div>${item.type}</div>
      <div>${item.version || '-'}</div>
    </div>
  `).join('');
}

loadServers();

const serverForm = document.getElementById('server-form');
serverForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    name: form.name.value.trim(),
    host: form.host.value.trim(),
    port: Number(form.port.value) || 3306,
    type: form.type.value.trim(),
    version: form.version.value.trim(),
    root_user: form.root_user.value.trim(),
  };

  try {
    await apiRequest('/servers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    form.reset();
    await loadServers();
  } catch (err) {
    alert(err.message);
  }
});
