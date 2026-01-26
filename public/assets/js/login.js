document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    email: form.email.value.trim(),
    password: form.password.value,
  };

  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setToken(data.token);
    window.location.href = 'dashboard.html';
  } catch (err) {
    alert(err.message);
  }
});
