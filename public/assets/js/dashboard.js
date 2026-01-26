(async () => {
  try {
    const [projects, templates, actions] = await Promise.all([
      apiRequest('/projects'),
      apiRequest('/templates'),
      apiRequest('/projects/1/actions').catch(() => ({ items: [] })),
    ]);

    document.getElementById('stat-projects').textContent = projects.items.length;
    document.getElementById('stat-templates').textContent = templates.items.length;
    document.getElementById('stat-actions').textContent = actions.items.length;

    const container = document.getElementById('recent-projects');
    container.innerHTML = projects.items.slice(0, 5).map((item) => `
      <div class="table-row">
        <div>${item.code}</div>
        <div>${item.name}</div>
        <div>${item.version || '-'}</div>
        <div>${item.type || '-'}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
})();
