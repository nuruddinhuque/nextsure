/* ============================
   Configuration (your APIs)
   ============================ */
const API_GET = '/api/get-orders';
const API_UPDATE = '/api/orders/update';       // expects JSON { ...order fields... }
const API_DELETE = '/api/delete-order';        // expects JSON { orderId }
const API_STATUS = '/api/update-status';       // expects JSON { orderId, status }

let orders = [];      // loaded orders
let filtered = [];    // filtered list
let currentPage = 1;
let pageSize = 10;
let selectedOrder = null;

/* --------------------
   Helpers
   -------------------- */
function qs(id){ return document.getElementById(id); }
function fmtDate(dt){ if(!dt) return ''; const d = new Date(dt); return d.toLocaleString(); }
function showToast(msg, icon='success'){ Swal.fire({ toast:true, position:'top-end', showConfirmButton:false, timer:2000, icon, title: msg }); }

/* --------------------
   Load orders from API
   -------------------- */
async function fetchOrders(){
  try{
    const res = await fetch(API_GET);
    if(!res.ok) throw new Error('Network response not ok');
    const data = await res.json();
    // normalize: ensure calc parsed if string
    orders = Array.isArray(data) ? data : (data.orders || []);
    // allow server to send createdAt/dateTime — if missing, use now
    orders = orders.map(o=>{
      if(!o.createdAt && o.dateTime) o.createdAt = o.dateTime;
      if(!o.createdAt) o.createdAt = new Date().toISOString();
      // if calc is string, parse
      if(o.calc && typeof o.calc === 'string'){
        try{ o.calc = JSON.parse(o.calc); }catch(e){ /* ignore */ }
      }
      return o;
    });
    applyFiltersAndRender();
  }catch(err){
    console.error(err);
    showToast('Failed to load orders', 'error');
  }
}

/* --------------------
   Apply search / filter, paginate & render
   -------------------- */
function applyFiltersAndRender(){
  const term = qs('searchInput').value.trim().toLowerCase();
  const statusFilter = qs('statusFilter').value;
  pageSize = parseInt(qs('pageSize').value,10);

  filtered = orders.filter(o=>{
    const searchText = [
      o.orderId, o.customerName, o.contact, o.country, o.company, o.occupation
    ].map(s => (s||'').toString().toLowerCase()).join(' ');
    if(term && !searchText.includes(term)) return false;
    if(statusFilter && ((o.status||'').toLowerCase() !== statusFilter.toLowerCase())) return false;
    return true;
  });

  // pagination
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if(currentPage > pages) currentPage = pages;

  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  renderTable(pageItems, total);
  qs('currentPage').innerText = `${currentPage} / ${pages}`;
  qs('rowsInfo').innerText = `${total} orders — showing ${pageItems.length}`;
}

/* --------------------
   Render rows
   -------------------- */
function renderTable(arr, total){
  const tbody = qs('tbody');
  tbody.innerHTML = '';
  if(!arr.length){
    tbody.innerHTML = `<tr><td class="p-4 text-center text-slate-500" colspan="18">No orders found</td></tr>`;
    return;
  }

  arr.forEach((o, idx) => {
    const calc = o.calc || {};
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50';
    tr.classList.add(
  (o.status || 'Pending').toLowerCase() === 'approved' ? 'status-approved' :
  (o.status || 'Pending').toLowerCase() === 'rejected' ? 'status-rejected' :
  'status-pending'
);


    const statusBadge = (o.status||'Pending') === 'Approved' ? 
      `<span class="px-2 py-1 rounded bg-green-100 text-green-700 text-xs">Approved</span>` :
      ( (o.status||'Pending') === 'Rejected' ? `<span class="px-2 py-1 rounded bg-red-100 text-red-700 text-xs">Rejected</span>` :
      `<span class="px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs">Pending</span>` );

    tr.innerHTML = `
      <td class="p-2 text-xs">${ (currentPage-1)*pageSize + idx + 1 }</td>
      <td class="p-2 text-xs">${ fmtDate(o.createdAt) }</td>
      <td class="p-2 font-medium text-indigo-600">${ o.orderId || '' }</td>
      <td class="p-2">
         <div class="font-semibold">${ escapeHtml(o.customerName) || '' }</div>
         <div class="small">${ escapeHtml(o.address || '') }</div>
      </td>
      <td class="p-2 small">${ escapeHtml(o.company || '') }</td>
      <td class="p-2 small">${ escapeHtml(calc.plan || o.plan || '') }</td>
      <td class="p-2 small">${ escapeHtml(o.dob || '') }</td>
      <td class="p-2 small">${ escapeHtml(calc.age || o.age || '') }</td>
      <td class="p-2 small">${ escapeHtml(calc.days || o.duration || '') }</td>
      <td class="p-2 small">${ escapeHtml(o.country || '') }</td>
      <td class="p-2 small">${ escapeHtml(o.occupation || '') }</td>
      <td class="p-2 small">${ escapeHtml(o.travelDate || '') }</td>
      <td class="p-2 small">${ escapeHtml(o.contact || '') }</td>
      <td class="p-2 small">${ escapeHtml(o.email || '') }</td>
      <td class="p-2 small">${ escapeHtml(calc.multiplier?.toString() || o.multiplier?.toString() || '') }</td>
      <td class="p-2 small">${ escapeHtml(calc.adminDiscount?.toString() || o.offer?.toString() || '') }%</td>
      <td class="p-2 font-semibold text-green-700">৳${ (calc.totalPayable || o.total || 0) }</td>
      <td class="p-2">${ statusBadge }</td>
      <td class="p-2">
        <div class="flex gap-1">
          <button class="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs" onclick='onEdit("${o.orderId}")'>Edit</button>
          <button class="px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs" onclick='onPDF("${o.orderId}")'>PDF</button>
          <button class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs" onclick='onDelete("${o.orderId}")'>Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* --------------------
   Utilities: escapeHtml
   -------------------- */
function escapeHtml(s){ if(s===undefined || s===null) return ''; return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]); }

/* --------------------
   Actions: View / Edit / Delete / Status / PDF
   -------------------- */
function findOrder(id){ return orders.find(o => String(o.orderId) === String(id)); }

function onView(id){
  const o = findOrder(id);
  if(!o) return showToast('Order not found', 'error');
  // show modal in read-only (fill form)
  openModalWithOrder(o);
}

function onEdit(id){
  const o = findOrder(id);
  if(!o) return showToast('Order not found', 'error');
  openModalWithOrder(o);
}

async function onDelete(id){
  const { isConfirmed } = await Swal.fire({
    title: 'Delete order?',
    text: 'This action cannot be undone.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Delete'
  });
  if(!isConfirmed) return;
  try{
    const res = await fetch(API_DELETE, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ orderId: id })
    });
    const j = await res.json();
    if(j.success || res.ok){
      showToast('Deleted');
      // remove locally as well
      orders = orders.filter(o=>o.orderId !== id);
      applyFiltersAndRender();
    } else {
      showToast(j.message || 'Delete failed', 'error');
    }
  }catch(err){
    console.error(err);
    showToast('Delete request failed', 'error');
  }
}

async function onToggleStatus(id){
  const o = findOrder(id);
  if(!o) return;
  const current = o.status || 'Pending';
  const next = current === 'Approved' ? 'Pending' : (current === 'Pending' ? 'Approved' : 'Pending');
  const { isConfirmed } = await Swal.fire({
    title: `Change status to ${next}?`,
    showCancelButton: true,
    confirmButtonText: 'Yes'
  });
  if(!isConfirmed) return;
  try{
    const res = await fetch(API_STATUS, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ orderId: id, status: next })
    });
    const j = await res.json();
    if(j.success || res.ok){
      o.status = next;
      showToast(`Status: ${next}`);
      applyFiltersAndRender();
    } else {
      showToast(j.message || 'Status update failed','error');
    }
  }catch(err){
    console.error(err);
    showToast('Status update failed','error');
  }
}

/* --------------------
   PDF generation using jsPDF & html2canvas
   -------------------- */
async function generatePDFforOrder(o){
  // create a simple layout with text and image (if any)
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const left = 40, topStart = 40;
  let y = topStart;
  doc.setFontSize(14); doc.text(`Order Report — ${o.orderId || ''}`, left, y); y += 18;
  doc.setFontSize(11);

  const rows = [
    ['Buyer Name', o.customerName || ''],
    ['Company', o.company || ''],
    ['Plan', (o.calc?.plan || o.plan) || ''],
    ['Total Premium (৳)', String(o.calc?.totalPayable || o.total || '')],
    ['DOB', o.dob || ''],
    ['Age Band', o.calc?.age || o.age || ''],
    ['Duration', o.calc?.days || o.duration || ''],
    ['Destination', o.country || ''],
    ['Occupation', o.occupation || ''],
    ['Travel Date', o.travelDate || ''],
    ['Mobile', o.contact || ''],
    ['email', o.email || ''],
    ['Multiplier', String(o.calc?.multiplier || o.multiplier || '')],
    ['Offer (%)', String(o.calc?.adminDiscount || o.offer || '')],
    ['address', o.address || '']
  ];

  rows.forEach(r=>{
    const [k,v] = r;
    doc.text(`${k}: ${v}`, left, y);
    y += 14;
    if(y > 720){ doc.addPage(); y = 40; }
  });

  // attempt to add passport image if available (o.passportUrl or o.passportFilename)
  const passportUrl = o.passportUrl || o.passport || o.passportFilename || o.passportFile;
  if(passportUrl){
    try{
      // fetch image, convert to blob -> canvas
      const imgResp = await fetch(passportUrl);
      if(imgResp.ok){
        const blob = await imgResp.blob();
        const img = await createImageBitmap(blob);
        // draw to canvas then add image
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0);
        const dataURL = canvas.toDataURL('image/jpeg', 0.85);
        if(y + 200 > 800){ doc.addPage(); y = 40; }
        doc.addImage(dataURL, 'JPEG', left, y, 150, 150);
        y += 160;
      }
    }catch(err){
      console.warn('Passport image add failed', err);
    }
  }

  // finish and save
  doc.save(`${o.orderId || 'order'}.pdf`);
}

async function onPDF(id){
  const o = findOrder(id);
  if(!o) return showToast('Order not found','error');
  showToast('Preparing PDF...');
  await generatePDFforOrder(o);
}

/* --------------------
   Modal open / fill / save actions
   -------------------- */
function openModalWithOrder(o){
  selectedOrder = JSON.parse(JSON.stringify(o)); // clone for editing
  qs('modal').classList.remove('hidden');
  qs('modalTitle').innerText = `Order — ${o.orderId || ''}`;
  // fill form
  qs('f_orderId').value = o.orderId || '';
  qs('f_customerName').value = o.customerName || '';
  qs('f_contact').value = o.contact || '';
  qs('f_email').value = o.email || '';
  qs('f_company').value = o.company || '';
  qs('f_plan').value = (o.calc?.plan || o.plan) || '';
  qs('f_total').value = (o.calc?.totalPayable || o.total) || '';
  qs('f_dob').value = o.dob || '';
  qs('f_age').value = o.calc?.age || o.age || '';
  qs('f_duration').value = o.calc?.days || o.duration || '';
  qs('f_country').value = o.country || '';
  qs('f_occupation').value = o.occupation || '';
  qs('f_travelDate').value = o.travelDate || '';
  qs('f_address').value = o.address || '';
  qs('f_multiplier').value = o.calc?.multiplier || o.multiplier || '';
  qs('f_offer').value = o.calc?.adminDiscount || o.offer || '';
  qs('f_status').value = o.status || 'Pending';

  // passport preview
  const passportUrl = o.passportUrl || o.passport || o.passportFilename || o.passportFile;
  if(passportUrl){
    qs('passportPreview').src = passportUrl;
    qs('passportPreview').classList.remove('hidden');
    qs('passportLink').href = passportUrl; qs('passportLink').classList.remove('hidden');
    qs('noPassport').classList.add('hidden');
  } else {
    qs('passportPreview').classList.add('hidden');
    qs('passportLink').classList.add('hidden');
    qs('noPassport').classList.remove('hidden');
  }
}

/* Close modal */
qs('closeModal').addEventListener('click', ()=> { qs('modal').classList.add('hidden'); selectedOrder = null; });

/* Save button */
qs('saveBtn').addEventListener('click', async () => {
  if(!selectedOrder) return;
  // read all fields (all editable)
  const updated = {
    orderId: qs('f_orderId').value,
    customerName: qs('f_customerName').value,
    contact: qs('f_contact').value,
    email: qs('f_email').value,
    company: qs('f_company').value,
    plan: qs('f_plan').value,
    total: parseFloat(qs('f_total').value) || 0,
    dob: qs('f_dob').value,
    age: qs('f_age').value,
    duration: qs('f_duration').value,
    country: qs('f_country').value,
    occupation: qs('f_occupation').value,
    travelDate: qs('f_travelDate').value,
    delivery: qs('f_address').value,
    multiplier: parseFloat(qs('f_multiplier').value) || 1,
    offer: parseFloat(qs('f_offer').value) || 0,
    status: qs('f_status').value
  };

  // merge into selectedOrder/cloned object
  const payload = { ...selectedOrder, ...updated };

  try{
    const res = await fetch(API_UPDATE, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await res.json();
    if(j.success || res.ok){
      // update local list (optimistic)
      const idx = orders.findIndex(x=>x.orderId === payload.orderId);
      if(idx !== -1) orders[idx] = { ...orders[idx], ...payload };
      applyFiltersAndRender();
      showToast('Order updated');
      qs('modal').classList.add('hidden');
      selectedOrder = null;
    } else {
      showToast(j.message || 'Update failed', 'error');
    }
  }catch(err){
    console.error(err);
    showToast('Update request failed', 'error');
  }
});

/* Delete from modal */
qs('deleteBtn').addEventListener('click', async ()=>{
  const id = qs('f_orderId').value;
  if(!id) return;
  const { isConfirmed } = await Swal.fire({ title:'Delete this order?', icon:'warning', showCancelButton:true, confirmButtonText:'Delete' });
  if(!isConfirmed) return;
  try{
    const res = await fetch(API_DELETE, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ orderId: id })
    });
    const j = await res.json();
    if(j.success || res.ok){
      orders = orders.filter(o=>o.orderId !== id);
      applyFiltersAndRender();
      qs('modal').classList.add('hidden');
      showToast('Deleted');
    } else {
      showToast(j.message || 'Delete failed', 'error');
    }
  }catch(err){
    console.error(err);
    showToast('Delete request failed','error');
  }
});

/* Download selected PDF from modal (button) */
qs('pdfBtn').addEventListener('click', async ()=>{
  const id = qs('f_orderId').value;
  if(!id) return;
  const o = findOrder(id);
  if(!o) return showToast('Order not found','error');
  await generatePDFforOrder(o);
});

/* --------------------
   Buttons & Events
   -------------------- */
qs('refreshBtn').addEventListener('click', ()=> fetchOrders());
qs('searchInput').addEventListener('input', ()=> { currentPage = 1; applyFiltersAndRender(); });
qs('statusFilter').addEventListener('change', ()=> { currentPage = 1; applyFiltersAndRender(); });
qs('pageSize').addEventListener('change', ()=> { currentPage = 1; applyFiltersAndRender(); });

qs('prevPage').addEventListener('click', ()=> {
  if(currentPage>1) { currentPage--; applyFiltersAndRender(); }
});
qs('nextPage').addEventListener('click', ()=> {
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if(currentPage < pages) { currentPage++; applyFiltersAndRender(); }
});

qs('exportAll').addEventListener('click', ()=> {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(orders, null, 2));
  const a = document.createElement('a'); a.href = dataStr; a.download = `nextsure_orders_${new Date().toISOString().slice(0,10)}.json`; a.click();
});

qs('downloadSelectedPDF').addEventListener('click', async ()=> {
  // download PDF of first selected visible order (if none selected, first on page)
  const visible = filtered.slice((currentPage-1)*pageSize, (currentPage-1)*pageSize + pageSize);
  if(!visible.length) return showToast('No visible order','error');
  await generatePDFforOrder(visible[0]);
});

qs('clearLocal').addEventListener('click', ()=> {
  if(confirm('This will clear only local cached orders (does not call API). Continue?')){
    localStorage.removeItem('ns_orders'); showToast('Local cleared'); fetchOrders();
  }
});

/* --------------------
   Boot
   -------------------- */
window.addEventListener('load', ()=> {
  // initial page size
  pageSize = parseInt(qs('pageSize').value,10);
  fetchOrders();
});

/* ==================================================
   UNIVERSAL DRAG SCROLL (RIGHT + LEFT + TOUCH)
   FOR .table-scroll
   ================================================== */

const dragArea = document.querySelector('.table-scroll');

let isDown = false;
let startX = 0;
let scrollLeft = 0;
let dragButton = null; // 0 = left, 2 = right

// Prevent context menu only inside drag area
dragArea.addEventListener("contextmenu", e => e.preventDefault());

// MOUSE DOWN — Detect Left or Right Button
dragArea.addEventListener("mousedown", (e) => {
  if (e.button !== 0 && e.button !== 2) return; // Only left & right

  isDown = true;
  dragButton = e.button;

  dragArea.classList.add("dragging");

  startX = e.pageX - dragArea.offsetLeft;
  scrollLeft = dragArea.scrollLeft;
});

// STOP Drag on Mouse Leave
dragArea.addEventListener("mouseleave", () => {
  isDown = false;
  dragArea.classList.remove("dragging");
});

// STOP Drag on Mouse Up
dragArea.addEventListener("mouseup", () => {
  isDown = false;
  dragArea.classList.remove("dragging");
});

// MOUSE MOVE — Handle Drag
dragArea.addEventListener("mousemove", (e) => {
  if (!isDown) return;

  e.preventDefault();

  const x = e.pageX - dragArea.offsetLeft;
  const walk = (x - startX) * 2; // Drag speed

  dragArea.scrollLeft = scrollLeft - walk;
});

/* ==================================================
   TOUCH DRAG (Mobile / Tablet)
   ================================================== */

let isTouching = false;
let touchStartX = 0;
let touchScrollLeft = 0;

dragArea.addEventListener("touchstart", (e) => {
  isTouching = true;
  dragArea.classList.add("dragging");

  touchStartX = e.touches[0].pageX - dragArea.offsetLeft;
  touchScrollLeft = dragArea.scrollLeft;
});

dragArea.addEventListener("touchend", () => {
  isTouching = false;
  dragArea.classList.remove("dragging");
});

dragArea.addEventListener("touchmove", (e) => {
  if (!isTouching) return;

  const x = e.touches[0].pageX - dragArea.offsetLeft;
  const walk = (x - touchStartX) * 2;

  dragArea.scrollLeft = touchScrollLeft - walk;
});
// PROTECT DASHBOARD
function protect(req, res, next){
  if(req.session.logged) return next();
  return res.redirect("/login.html");
}

app.get("/dashboard.html", protect, (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/logout", (req, res)=>{
  req.session.destroy(()=>{
    res.redirect("/login.html");
  });
});
// Protect page
requireAuth('login.html');


firebase.auth().onAuthStateChanged(function(user){
if(user){
document.getElementById('user-info').innerText = 'Signed in as: ' + (user.email || user.phoneNumber || user.uid);
}
});

/* ============================
   End
   ============================ */