const token = localStorage.getItem('ns_token');
if (!token) window.location.href = '/login.html';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const authHeaders = { Authorization: `Bearer ${token}` };
let me = null;
let orders = [];
let users = [];
let notifications = [];
let selectedOrder = null;

const orderColumns = [
  ['serial', 'Serial Number'],
  ['createdAt', 'Date and Time'],
  ['orderId', 'Order ID'],
  ['customerName', 'Name'],
  ['address', 'Address'],
  ['company', 'Company'],
  ['plan', 'Plan'],
  ['dob', 'Date of Birth'],
  ['ageRange', 'Age Range'],
  ['duration', 'Duration'],
  ['destination', 'Destination'],
  ['profession', 'Profession'],
  ['travelDate', 'Date of Travel'],
  ['mobile', 'Mobile'],
  ['passportNumber', 'Passport Number'],
  ['passportAddress', 'Permanent Address on Passport'],
  ['paymentStatus', 'Payment Status'],
  ['total', 'Policy Total'],
  ['status', 'Status'],
  ['underwritingStatus', 'Underwriting'],
  ['policyDeliveryAddress', 'Policy Delivery Full Address'],
  ['action', 'Action'],
];

const editFields = [
  ['customerName', 'Name'],
  ['address', 'Address', 'textarea'],
  ['company', 'Company'],
  ['plan', 'Plan'],
  ['dob', 'Date of Birth', 'date'],
  ['ageRange', 'Age Range'],
  ['duration', 'Duration'],
  ['destination', 'Destination'],
  ['profession', 'Profession'],
  ['travelDate', 'Date of Travel', 'date'],
  ['mobile', 'Mobile'],
  ['email', 'Email', 'email'],
  ['passportNumber', 'Passport Number'],
  ['passportAddress', 'Permanent Address on Passport', 'textarea'],
  ['paymentStatus', 'Payment Status'],
  ['paymentReference', 'Payment Reference Number'],
  ['total', 'Policy Total', 'number'],
  ['multiplier', 'Multiplier', 'number'],
  ['offer', 'Offer / Discount', 'number'],
  ['status', 'Status'],
  ['underwritingStatus', 'Underwriting Status'],
  ['policyDeliveryAddress', 'Policy Delivery Full Address', 'textarea'],
  ['policyNumber', 'Policy Number'],
  ['mrNumber', 'MR Number'],
];

function logout() {
  localStorage.removeItem('ns_token');
  localStorage.removeItem('ns_user');
  window.location.href = '/login.html';
}
window.logout = logout;

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}), ...authHeaders };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Server error: API did not return JSON. Please check server.js and route path.');
  }
  if (!res.ok || data.success === false) throw new Error(data.message || 'Request failed');
  return data;
}

function roleName(role) {
  return {
    main_admin: 'Main Admin',
    branch_admin: 'Branch Admin',
    agency: 'Agency',
    customer: 'Customer',
  }[role] || role;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB');
}

function money(value) {
  return `৳${Number(value || 0).toLocaleString()}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;',
  }[c]));
}

function badge(value) {
  const text = String(value || 'Pending');
  const lower = text.toLowerCase();
  let cls = '';
  if (lower.includes('pending')) cls = 'pending';
  if (lower.includes('done') || lower.includes('approved') || lower.includes('processed')) cls = 'done';
  if (lower.includes('cancel') || lower.includes('reject')) cls = 'cancel';
  return `<span class="badge ${cls}">${escapeHtml(text)}</span>`;
}

function orderValue(order, key) {
  if (key === 'createdAt') return formatDate(order.createdAt);
  if (key === 'total') return money(order.policyTotal || order.total);
  if (key === 'status' || key === 'underwritingStatus' || key === 'paymentStatus') return badge(order[key]);
  return escapeHtml(order[key] ?? '');
}

function setRoleVisibility() {
  const isMain = me?.role === 'main_admin';
  $$('.main-only').forEach((el) => el.classList.toggle('hide', !isMain));
}

function renderProfile() {
  $('#uName').textContent = me.name || 'User';
  $('#uRole').textContent = roleName(me.role);
  $('#uEmail').textContent = me.email || me.phone || '';

  const form = $('#profileForm');
  if (form) {
    form.name.value = me.name || '';
    form.phone.value = me.phone || '';
    form.email.value = me.email || '';
    form.address.value = me.address || '';
  }
}

function renderStats() {
  const pending = orders.filter((o) => String(o.status || '').toLowerCase().includes('pending')).length;
  const done = orders.filter((o) => /done|processed|approved/i.test(o.status || '')).length;
  const total = orders.reduce((sum, o) => sum + Number(o.policyTotal || o.total || 0), 0);

  $('#statOrders').textContent = orders.length;
  $('#statPending').textContent = pending;
  $('#statDone').textContent = done;
  $('#statTotal').textContent = money(total);
}

function renderOrders() {
  const query = ($('#orderSearch')?.value || '').toLowerCase().trim();
  const filtered = orders.filter((order) => {
    const text = `${order.orderId || ''} ${order.customerName || ''} ${order.mobile || ''} ${order.email || ''}`.toLowerCase();
    return text.includes(query);
  });

  $('#ordersHead').innerHTML = orderColumns.map(([, title]) => `<th>${title}</th>`).join('');
  $('#ordersBody').innerHTML = filtered.map((order) => {
    const cells = orderColumns.map(([key]) => {
      if (key === 'action') {
        return `<td><button class="outline" onclick="openOrder('${order.orderId}')">Open</button></td>`;
      }
      return `<td>${orderValue(order, key)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('') || `<tr><td colspan="${orderColumns.length}">No orders found.</td></tr>`;
}

function renderUsers() {
  const box = $('#usersList');
  if (!box) return;

  box.innerHTML = users.map((user) => {
    const label = `${roleName(user.role)} • ${user.status || 'approved'}`;
    const approveBtn = user.status !== 'approved'
      ? `<button class="outline" onclick="setUserStatus('${user.userId}','approved')">Approve</button>`
      : '';
    const disableBtn = user.status !== 'disabled'
      ? `<button class="outline danger-text" onclick="setUserStatus('${user.userId}','disabled')">Disable</button>`
      : `<button class="outline" onclick="setUserStatus('${user.userId}','approved')">Enable</button>`;

    return `
      <div class="user-item">
        <div>
          <b>${escapeHtml(user.agencyName || user.companyName || user.name || user.userId)}</b><br />
          <small>${escapeHtml(label)} • ${escapeHtml(user.email || user.phone || '')}</small>
          ${user.visitingCard ? `<br><a class="file-link" href="${user.visitingCard}" target="_blank">Visiting Card</a>` : ''}
        </div>
        <div class="actions-row">${approveBtn}${disableBtn}</div>
      </div>`;
  }).join('') || '<p>No users found.</p>';
}

function renderNotifications() {
  const box = $('#notesList');
  if (!box) return;

  box.innerHTML = notifications.map((note) => `
    <div class="note-item">
      <div>
        <b>${escapeHtml(note.message || 'Notification')}</b><br />
        <small>${formatDate(note.createdAt)} ${note.orderId ? '• ' + escapeHtml(note.orderId) : ''}</small>
      </div>
    </div>`).join('') || '<p>No notifications.</p>';
}

async function loadMe() {
  const data = await api('/api/auth/me');
  me = data.user;
  localStorage.setItem('ns_user', JSON.stringify(me));
  renderProfile();
  setRoleVisibility();
}

async function loadOrders() {
  orders = await api('/api/get-orders');
  renderStats();
  renderOrders();
}

async function loadUsers() {
  if (me?.role !== 'main_admin') return;
  users = await api('/api/users');
  renderUsers();
}

async function loadNotifications() {
  notifications = await api('/api/notifications');
  renderNotifications();
}

async function refreshAll() {
  try {
    await loadMe();
    await Promise.all([loadOrders(), loadUsers(), loadNotifications()]);
  } catch (err) {
    alert(err.message || 'Dashboard loading failed');
    if (/login|required|token/i.test(err.message)) logout();
  }
}

function openOrder(orderId) {
  selectedOrder = orders.find((order) => order.orderId === orderId);
  if (!selectedOrder) return;

  $('#modalTitle').textContent = `Order ${selectedOrder.orderId}`;
  $('#modalSub').textContent = `Serial: ${selectedOrder.serial || ''} • ${formatDate(selectedOrder.createdAt)}`;

  const canEditAll = me.role === 'main_admin';
  const branchEdit = me.role === 'branch_admin';
  const customerAgencyEdit = me.role === 'customer' || me.role === 'agency';

  let html = editFields.map(([key, label, type = 'text']) => {
    if (me.role === 'branch_admin' && ['multiplier', 'offer'].includes(key)) return '';

    let readonly = '';
    if (!canEditAll) {
      if (branchEdit && !['underwritingStatus', 'policyNumber', 'mrNumber', 'status'].includes(key)) readonly = 'readonly';
      if (customerAgencyEdit && !['paymentReference', 'paymentStatus'].includes(key)) readonly = 'readonly';
    }

    const value = escapeHtml(selectedOrder[key] ?? '');
    if (type === 'textarea') {
      return `<label>${label}<textarea name="${key}" rows="3" ${readonly}>${value}</textarea></label>`;
    }
    return `<label>${label}<input name="${key}" type="${type}" value="${value}" ${readonly} /></label>`;
  }).join('');

  if (canEditAll) {
    const branchOptions = users
      .filter((u) => u.role === 'branch_admin' && u.status === 'approved')
      .map((u) => `<option value="${u.branchId || u.userId}" ${selectedOrder.assignedBranchId === (u.branchId || u.userId) ? 'selected' : ''}>${escapeHtml(u.companyName || u.name)}</option>`)
      .join('');
    html += `
      <label>Assign Branch Admin
        <select name="assignedBranchId">
          <option value="">Not Assigned</option>
          ${branchOptions}
        </select>
      </label>`;
  }

  if (branchEdit) {
    html += `
      <label>Upload Policy PDF
        <input name="policyPdf" type="file" accept="application/pdf" />
      </label>`;
  }

  if (selectedOrder.passportFile) {
    html += `<div class="full"><a class="file-link" href="${selectedOrder.passportFile}" target="_blank">View Passport Image / File</a></div>`;
  }
  if (selectedOrder.policyPdf) {
    html += `<div class="full"><a class="file-link" href="${selectedOrder.policyPdf}" target="_blank">Download Policy PDF</a></div>`;
  }

  $('#editFields').innerHTML = html;
  $('#orderModal').showModal();
}
window.openOrder = openOrder;

function closeModal() {
  $('#orderModal').close();
}
window.closeModal = closeModal;

async function saveOrder(event) {
  event.preventDefault();
  if (!selectedOrder) return;

  try {
    const form = event.target;
    const fd = new FormData(form);
    const data = await api(`/api/orders/${selectedOrder.orderId}/update`, {
      method: 'POST',
      body: fd,
    });

    selectedOrder = data.order;
    await loadOrders();
    closeModal();
    alert('Order updated successfully');
  } catch (err) {
    alert(err.message || 'Order update failed');
  }
}

function downloadOrderPdf() {
  if (!selectedOrder) return;
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    alert('PDF library not loaded. Internet connection may be required for CDN.');
    return;
  }

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('NextSure Order Invoice', 14, 18);
  doc.setFontSize(10);

  const lines = [
    ['Serial Number', selectedOrder.serial],
    ['Date and Time', formatDate(selectedOrder.createdAt)],
    ['Order ID', selectedOrder.orderId],
    ['Name', selectedOrder.customerName],
    ['Mobile', selectedOrder.mobile],
    ['Email', selectedOrder.email],
    ['Company', selectedOrder.company],
    ['Plan', selectedOrder.plan],
    ['Destination', selectedOrder.destination],
    ['Travel Date', selectedOrder.travelDate],
    ['Passport Number', selectedOrder.passportNumber],
    ['Payment Status', selectedOrder.paymentStatus],
    ['Payment Reference', selectedOrder.paymentReference],
    ['Status', selectedOrder.status],
    ['Underwriting', selectedOrder.underwritingStatus],
    ['Policy Number', selectedOrder.policyNumber],
    ['MR Number', selectedOrder.mrNumber],
    ['Policy Total', money(selectedOrder.policyTotal || selectedOrder.total)],
  ];

  let y = 32;
  lines.forEach(([label, value]) => {
    doc.text(`${label}: ${value || ''}`, 14, y);
    y += 8;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save(`${selectedOrder.orderId || 'order'}.pdf`);
}

async function setUserStatus(userId, status) {
  try {
    await api(`/api/users/${userId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await loadUsers();
    alert('User updated');
  } catch (err) {
    alert(err.message || 'User update failed');
  }
}
window.setUserStatus = setUserStatus;

function bindEvents() {
  $$('.nav-btn[data-sec]').forEach((button) => {
    button.addEventListener('click', () => {
      $$('.nav-btn[data-sec]').forEach((btn) => btn.classList.remove('active'));
      $$('.section').forEach((section) => section.classList.remove('active'));
      button.classList.add('active');
      $(`#${button.dataset.sec}`).classList.add('active');
      $('#pageTitle').textContent = button.textContent.trim();
    });
  });

  $('#refreshBtn')?.addEventListener('click', refreshAll);
  $('#orderSearch')?.addEventListener('input', renderOrders);
  $('#editOrderForm')?.addEventListener('submit', saveOrder);
  $('#pdfBtn')?.addEventListener('click', downloadOrderPdf);

  $('#profileForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const fd = new FormData(event.target);
      const body = Object.fromEntries(fd.entries());
      const data = await api('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      me = data.user;
      renderProfile();
      alert('Profile saved');
    } catch (err) {
      alert(err.message || 'Profile save failed');
    }
  });

  $('#branchForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const fd = new FormData(event.target);
      const body = Object.fromEntries(fd.entries());
      await api('/api/users/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      event.target.reset();
      await loadUsers();
      alert('Branch Admin created');
    } catch (err) {
      alert(err.message || 'Branch admin create failed');
    }
  });

  $('#saveSettings')?.addEventListener('click', async () => {
    try {
      const settings = {};
      $$('[data-setting]').forEach((input) => { settings[input.dataset.setting] = input.checked; });
      await api('/api/auth/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      alert('Settings saved');
    } catch (err) {
      alert(err.message || 'Settings save failed');
    }
  });

  $('#backupBtn')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ orders, users, notifications }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nextsure-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#clearTestBtn')?.addEventListener('click', () => {
    alert('Safety: Clear Test Data button is UI only. Database delete API is intentionally not connected here.');
  });
}

bindEvents();
refreshAll();
