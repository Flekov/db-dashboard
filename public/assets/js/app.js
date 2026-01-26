(async () => {
  const authRequired = document.body.dataset.auth === 'required';
  if (authRequired && !localStorage.getItem('dbdash_token')) {
    window.location.href = 'login.html';
    return;
  }

  const userPill = document.getElementById('user-pill');
  if (userPill) {
    try {
      const me = await apiRequest('/auth/me');
      userPill.textContent = `${me.name} (${me.role})`;
    } catch (err) {
      setToken(null);
      window.location.href = 'login.html';
    }
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiRequest('/auth/logout', { method: 'POST' });
      } catch (err) {
        // ignore
      }
      setToken(null);
      window.location.href = 'login.html';
    });
  }
})();
