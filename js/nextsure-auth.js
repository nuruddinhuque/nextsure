const $ = (selector) => document.querySelector(selector);

function showMessage(message, ok = false) {
  const el = $('#msg');
  el.className = `msg show ${ok ? 'ok' : 'error'}`;
  el.textContent = message;
}

function saveAuth(response) {
  if (!response.token) {
    showMessage(response.message || 'Account created, but login is not allowed yet.', true);
    return;
  }
  localStorage.setItem('ns_token', response.token);
  localStorage.setItem('ns_user', JSON.stringify(response.user || {}));
  window.location.href = '/dashboard.html';
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Server error: API did not return JSON. Please check server.js and MONGO_URI.');
  }
}

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    document.querySelectorAll('.auth-pane').forEach((pane) => pane.classList.add('hide'));
    button.classList.add('active');
    $(`#${button.dataset.tab}Form`).classList.remove('hide');
  });
});

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(event.target);
  const body = {
    email: fd.get('email'),
    phone: fd.get('email'),
    password: fd.get('password'),
  };

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await readJson(res);
    if (!res.ok || !data.success) throw new Error(data.message || 'Login failed');
    saveAuth(data);
  } catch (err) {
    showMessage(err.message || 'Login failed');
  }
});

$('#customerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(event.target);
  fd.append('role', 'customer');

  try {
    const res = await fetch('/api/auth/register', { method: 'POST', body: fd });
    const data = await readJson(res);
    if (!res.ok || !data.success) throw new Error(data.message || 'Registration failed');
    saveAuth(data);
  } catch (err) {
    showMessage(err.message || 'Registration failed');
  }
});

$('#agencyForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(event.target);
  fd.append('role', 'agency');

  try {
    const res = await fetch('/api/auth/register', { method: 'POST', body: fd });
    const data = await readJson(res);
    if (!res.ok || !data.success) throw new Error(data.message || 'Agency registration failed');
    showMessage(data.message || 'Agency registration submitted.', true);
  } catch (err) {
    showMessage(err.message || 'Agency registration failed');
  }
});

$('#googleBtn').addEventListener('click', async () => {
  const email = prompt('Google email দিন:');
  if (!email) return;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', email, name: email.split('@')[0] }),
    });
    const data = await readJson(res);
    if (!res.ok || !data.success) throw new Error(data.message || 'Google login failed');
    saveAuth(data);
  } catch (err) {
    showMessage(err.message || 'Google login failed');
  }
});

$('#phoneBtn').addEventListener('click', async () => {
  const phone = prompt('Phone number দিন:');
  if (!phone) return;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'phone', phone, name: phone }),
    });
    const data = await readJson(res);
    if (!res.ok || !data.success) throw new Error(data.message || 'Phone login failed');
    saveAuth(data);
  } catch (err) {
    showMessage(err.message || 'Phone login failed');
  }
});
