(async () => {
  const panel = document.getElementById('admin-panel');
  try {
    const data = await apiRequest('/auth/me');
    panel.innerHTML = `
      <div class="table-row">
        <div>User</div>
        <div>${data.name}</div>
        <div>${data.email}</div>
        <div>${data.role}</div>
      </div>
    `;
  } catch (err) {
    panel.innerHTML = '<div class="table-row">No data</div>';
  }
})();
