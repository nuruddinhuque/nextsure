const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'nextsure_change_this_secret';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });
const multi = upload.fields([
  { name: 'passportFile', maxCount: 1 },
  { name: 'passportImage', maxCount: 1 },
  { name: 'visitingCard', maxCount: 1 },
  { name: 'policyPdf', maxCount: 1 },
]);

let dbReady = false;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 90000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const salt = storedHash.split(':')[0];
  return hashPassword(password, salt) === storedHash;
}

function makeToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function readToken(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    if (expected !== sig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true, unique: true },
    role: { type: String, index: true },
    name: String,
    phone: String,
    email: { type: String, lowercase: true, index: true },
    address: String,
    passwordHash: String,
    provider: String,
    status: { type: String, default: 'approved', index: true },
    agencyId: String,
    agencyName: String,
    companyName: String,
    branchId: String,
    visitingCard: String,
    permissions: Object,
    settings: Object,
  },
  { timestamps: true, strict: false }
);

const orderSchema = new mongoose.Schema(
  {
    serial: Number,
    orderId: { type: String, index: true },
    customerName: String,
    name: String,
    address: String,
    company: String,
    plan: String,
    dob: String,
    age: String,
    ageRange: String,
    duration: String,
    country: String,
    destination: String,
    occupation: String,
    profession: String,
    travelDate: String,
    contact: String,
    mobile: String,
    email: String,
    passportNumber: String,
    passportAddress: String,
    paymentStatus: { type: String, default: 'Unpaid' },
    paymentReference: String,
    total: Number,
    policyTotal: Number,
    multiplier: Number,
    offer: Number,
    status: { type: String, default: 'Pending' },
    underwritingStatus: { type: String, default: 'Pending' },
    policyDeliveryAddress: String,
    deliveryAddress: String,
    assignedBranchId: String,
    assignedBranchName: String,
    agencyId: String,
    customerUserId: String,
    passportFile: String,
    policyPdf: String,
    policyNumber: String,
    mrNumber: String,
    calc: Object,
    calculationData: Object,
    processedAt: Date,
    processedBy: String,
  },
  { timestamps: true, strict: false }
);

const notificationSchema = new mongoose.Schema(
  {
    role: String,
    userId: String,
    message: String,
    type: String,
    orderId: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const Notification = mongoose.model('Notification', notificationSchema);

function cleanUser(user) {
  const out = user?.toObject ? user.toObject() : { ...(user || {}) };
  delete out.passwordHash;
  delete out.__v;
  return out;
}

function uploaded(req, name) {
  const file = req.files?.[name]?.[0];
  return file ? `/uploads/${file.filename}` : undefined;
}

async function createNotification(data) {
  try {
    await Notification.create(data);
  } catch (err) {
    console.warn('Notification failed:', err.message);
  }
}

async function seedMainAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@nextsure.xyz').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || 'admin123';
  const exists = await User.findOne({ role: 'main_admin' });

  if (!exists) {
    await User.create({
      userId: 'MA' + Date.now(),
      role: 'main_admin',
      name: 'Main Admin',
      email,
      phone: '+8801851008300',
      passwordHash: hashPassword(password),
      status: 'approved',
    });
    console.log(`✅ Main Admin created: ${email}`);
  }
}

async function auth(req, res, next) {
  if (!dbReady) {
    return res.status(503).json({ success: false, message: 'Database not connected. Check MONGO_URI in .env' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token;
  const payload = readToken(token);
  if (!payload) return res.status(401).json({ success: false, message: 'Login required' });

  const user = await User.findOne({ userId: payload.userId });
  if (!user || user.status === 'disabled') {
    return res.status(403).json({ success: false, message: 'Account disabled' });
  }

  req.user = user;
  next();
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) return next();
    return res.status(403).json({ success: false, message: 'Permission denied' });
  };
}

function normalizeOrder(body, req, user) {
  let calc = body.calc || body.calculationData || {};
  if (typeof calc === 'string') {
    try {
      calc = JSON.parse(calc);
    } catch {
      calc = {};
    }
  }

  const total = Number(calc.totalPayable || body.total || body.policyTotal || 0);
  const name = body.customerName || body.name || body.fullName || '';

  return {
    orderId: body.orderId || 'NS' + Math.floor(100000 + Math.random() * 900000),
    customerName: name,
    name,
    address: body.address || '',
    company: body.company || '',
    plan: calc.plan || body.plan || '',
    dob: body.dob || body.dateOfBirth || '',
    age: calc.age || body.age || body.ageRange || '',
    ageRange: calc.age || body.ageRange || body.age || '',
    duration: calc.days || body.duration || '',
    country: body.country || body.destination || '',
    destination: body.destination || body.country || '',
    occupation: body.occupation || body.profession || '',
    profession: body.profession || body.occupation || '',
    travelDate: body.travelDate || body.dateOfTravel || '',
    contact: body.contact || body.mobile || body.phone || '',
    mobile: body.mobile || body.contact || body.phone || '',
    email: body.email || '',
    passportNumber: body.passportNumber || '',
    passportAddress: body.passportAddress || body.permanentAddressOnPassport || '',
    paymentStatus: body.paymentStatus || 'Unpaid',
    paymentReference: body.paymentReference || '',
    total,
    policyTotal: total,
    multiplier: Number(calc.multiplier || body.multiplier || 1),
    offer: Number(calc.adminDiscount || body.offer || 0),
    status: body.status || 'Pending',
    underwritingStatus: body.underwritingStatus || 'Pending',
    policyDeliveryAddress: body.policyDeliveryAddress || body.deliveryAddress || body.address || '',
    deliveryAddress: body.deliveryAddress || body.policyDeliveryAddress || body.address || '',
    passportFile: uploaded(req, 'passportFile') || uploaded(req, 'passportImage') || body.passportFile,
    policyPdf: uploaded(req, 'policyPdf') || body.policyPdf,
    policyNumber: body.policyNumber || '',
    mrNumber: body.mrNumber || '',
    calc,
    calculationData: calc,
    agencyId: user?.role === 'agency' ? user.agencyId || user.userId : body.agencyId,
    customerUserId: user?.role === 'customer' ? user.userId : body.customerUserId,
  };
}

function canSeeOrder(order, user) {
  if (user.role === 'main_admin') return true;
  if (user.role === 'branch_admin') return order.assignedBranchId === (user.branchId || user.userId);
  if (user.role === 'agency') return order.agencyId === (user.agencyId || user.userId);
  if (user.role === 'customer') {
    return order.customerUserId === user.userId || order.email === user.email || order.mobile === user.phone || order.contact === user.phone;
  }
  return false;
}

function maskOrder(order, role) {
  const out = order?.toObject ? order.toObject() : { ...(order || {}) };
  if (role === 'branch_admin') {
    delete out.offer;
    delete out.multiplier;
    if (out.calc) delete out.calc.adminDiscount;
    if (out.calculationData) delete out.calculationData.adminDiscount;
  }
  delete out.__v;
  return out;
}

app.post('/api/auth/register', multi, async (req, res) => {
  try {
    if (!dbReady) return res.status(503).json({ success: false, message: 'Database not connected' });

    const b = req.body;
    const role = b.role === 'agency' ? 'agency' : 'customer';
    const email = (b.email || '').toLowerCase();
    const phone = b.phone || b.mobile || '';

    if (!email && !phone) return res.status(400).json({ success: false, message: 'Email or phone required' });

    const exists = await User.findOne({ $or: [{ email }, { phone }].filter((x) => Object.values(x)[0]) });
    if (exists) return res.status(409).json({ success: false, message: 'Account already exists' });

    const id = (role === 'agency' ? 'AG' : 'CU') + Math.floor(100000 + Math.random() * 900000);
    const user = await User.create({
      userId: id,
      role,
      name: b.name || b.agencyName || 'User',
      phone,
      email,
      address: b.address || '',
      passwordHash: b.password ? hashPassword(b.password) : '',
      provider: b.provider || 'email',
      status: role === 'agency' ? 'pending' : 'approved',
      agencyId: role === 'agency' ? id : undefined,
      agencyName: b.agencyName || '',
      visitingCard: uploaded(req, 'visitingCard'),
    });

    if (role === 'agency') {
      await createNotification({ role: 'main_admin', type: 'agency', message: `New agency registration pending: ${user.agencyName || user.name}` });
    }

    res.json({
      success: true,
      message: role === 'agency' ? 'Agency registered. Main Admin approval required.' : 'Account created',
      user: cleanUser(user),
      token: user.status === 'approved' ? makeToken({ userId: user.userId, role: user.role }) : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!dbReady) return res.status(503).json({ success: false, message: 'Database not connected' });

    const b = req.body;
    if (b.provider === 'google' || b.provider === 'phone') {
      const query = b.provider === 'google' ? { email: (b.email || '').toLowerCase() } : { phone: b.phone };
      let user = await User.findOne(query);
      if (!user) {
        user = await User.create({
          userId: 'CU' + Math.floor(100000 + Math.random() * 900000),
          role: 'customer',
          name: b.name || 'Customer',
          ...query,
          provider: b.provider,
          status: 'approved',
        });
      }
      return res.json({ success: true, token: makeToken({ userId: user.userId, role: user.role }), user: cleanUser(user) });
    }

    const login = String(b.email || b.phone || '').toLowerCase();
    const user = await User.findOne({ $or: [{ email: login }, { phone: login }] });

    if (!user || !verifyPassword(b.password, user.passwordHash)) {
      return res.status(401).json({ success: false, message: 'Wrong login information' });
    }
    if (user.status !== 'approved') {
      return res.status(403).json({ success: false, message: `Account is ${user.status}. Main Admin approval required.` });
    }

    res.json({ success: true, token: makeToken({ userId: user.userId, role: user.role }), user: cleanUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ success: true, user: cleanUser(req.user) });
});

app.post('/api/auth/profile', auth, async (req, res) => {
  const b = req.body;
  const user = await User.findOneAndUpdate(
    { userId: req.user.userId },
    {
      name: b.name,
      phone: b.phone,
      email: (b.email || '').toLowerCase(),
      address: b.address,
      agencyName: b.agencyName,
      companyName: b.companyName,
    },
    { new: true }
  );
  res.json({ success: true, user: cleanUser(user) });
});

app.post('/api/auth/settings', auth, async (req, res) => {
  const user = await User.findOneAndUpdate({ userId: req.user.userId }, { settings: req.body.settings || req.body }, { new: true });
  res.json({ success: true, settings: user.settings || {} });
});

app.get('/api/users', auth, allowRoles('main_admin'), async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  res.json(users.map(cleanUser));
});

app.post('/api/users/branch', auth, allowRoles('main_admin'), async (req, res) => {
  const b = req.body;
  const id = 'BR' + Math.floor(100000 + Math.random() * 900000);
  const user = await User.create({
    userId: id,
    branchId: id,
    role: 'branch_admin',
    name: b.name || b.companyName,
    companyName: b.companyName,
    phone: b.phone,
    email: (b.email || '').toLowerCase(),
    address: b.address,
    passwordHash: hashPassword(b.password || 'branch123'),
    status: 'approved',
  });
  res.json({ success: true, user: cleanUser(user) });
});

app.post('/api/users/:id/status', auth, allowRoles('main_admin'), async (req, res) => {
  const user = await User.findOneAndUpdate(
    { userId: req.params.id },
    { status: req.body.status || 'approved', permissions: req.body.permissions },
    { new: true }
  );
  res.json({ success: true, user: cleanUser(user) });
});

app.post('/api/save-order', multi, async (req, res) => {
  try {
    if (!dbReady) return res.status(503).json({ success: false, message: 'Database not connected' });

    const payload = readToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    const user = payload ? await User.findOne({ userId: payload.userId }) : null;
    const data = normalizeOrder(req.body, req, user);
    const last = await Order.findOne().sort({ serial: -1 }).lean();
    data.serial = (last?.serial || 0) + 1;

    const order = await Order.create(data);
    await createNotification({ role: 'main_admin', type: 'order', orderId: order.orderId, message: `New order received: ${order.orderId}` });
    res.json({ success: true, message: 'Order Saved', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/get-orders', auth, async (req, res) => {
  const query = {};
  if (req.user.role === 'branch_admin') query.assignedBranchId = req.user.branchId || req.user.userId;
  if (req.user.role === 'agency') query.agencyId = req.user.agencyId || req.user.userId;
  if (req.user.role === 'customer') {
    query.$or = [
      { customerUserId: req.user.userId },
      { email: req.user.email },
      { mobile: req.user.phone },
      { contact: req.user.phone },
    ].filter((x) => Object.values(x)[0]);
  }

  const orders = await Order.find(query).sort({ createdAt: -1 });
  res.json(orders.map((order) => maskOrder(order, req.user.role)));
});

app.post('/api/orders/:id/update', auth, multi, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!canSeeOrder(order, req.user)) return res.status(403).json({ success: false, message: 'Permission denied' });

    let data = {};

    if (req.user.role === 'main_admin') {
      data = normalizeOrder({ ...order.toObject(), ...req.body, orderId: order.orderId }, req, req.user);
      delete data.orderId;
      delete data.serial;

      if (req.body.assignedBranchId) {
        const branch = await User.findOne({
          role: 'branch_admin',
          $or: [{ branchId: req.body.assignedBranchId }, { userId: req.body.assignedBranchId }],
        });
        data.assignedBranchId = branch ? branch.branchId || branch.userId : req.body.assignedBranchId;
        data.assignedBranchName = branch ? branch.companyName || branch.name : req.body.assignedBranchName;
        data.status = req.body.status || 'Processed';
        data.processedAt = new Date();
        data.processedBy = req.user.userId;
      }
    } else if (req.user.role === 'branch_admin') {
      ['underwritingStatus', 'policyNumber', 'mrNumber', 'status'].forEach((key) => {
        if (req.body[key] != null) data[key] = req.body[key];
      });
      const pdf = uploaded(req, 'policyPdf');
      if (pdf) data.policyPdf = pdf;
    } else {
      ['paymentReference', 'paymentStatus'].forEach((key) => {
        if (req.body[key] != null) data[key] = req.body[key];
      });
      if (data.paymentReference) data.paymentStatus = 'Reference Submitted';
    }

    const updated = await Order.findOneAndUpdate({ orderId: order.orderId }, data, { new: true });
    res.json({ success: true, order: maskOrder(updated, req.user.role) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/update-status', auth, async (req, res) => {
  const order = await Order.findOneAndUpdate({ orderId: req.body.orderId }, { status: req.body.status }, { new: true });
  res.json({ success: true, order });
});

app.post('/api/delete-order', auth, allowRoles('main_admin'), async (req, res) => {
  await Order.findOneAndDelete({ orderId: req.body.orderId });
  res.json({ success: true });
});

app.get('/api/export/orders.csv', auth, allowRoles('main_admin'), async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).lean();
  const cols = [
    'serial',
    'createdAt',
    'orderId',
    'customerName',
    'address',
    'company',
    'plan',
    'dob',
    'ageRange',
    'duration',
    'destination',
    'profession',
    'travelDate',
    'mobile',
    'passportNumber',
    'passportAddress',
    'paymentStatus',
    'paymentReference',
    'total',
    'status',
    'underwritingStatus',
    'policyNumber',
    'mrNumber',
    'policyDeliveryAddress',
  ];
  const csv = [cols.join(',')]
    .concat(orders.map((o) => cols.map((c) => `"${String(o[c] ?? '').replace(/"/g, '""')}"`).join(',')))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=nextsure-orders.csv');
  res.send(csv);
});

app.get('/api/notifications', auth, async (req, res) => {
  const notes = await Notification.find({
    $or: [{ userId: req.user.userId }, { role: req.user.role }, { role: req.user.role === 'main_admin' ? 'main_admin' : 'none' }],
  })
    .sort({ createdAt: -1 })
    .limit(80)
    .lean();
  res.json(notes);
});

app.get('/health', (req, res) => {
  res.json({ ok: true, dbReady, time: new Date() });
});

app.get('/', (req, res) => res.redirect('/login.html'));

if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME || 'nextsure' })
    .then(async () => {
      dbReady = true;
      console.log('✅ MongoDB Connected');
      await seedMainAdmin();
    })
    .catch((err) => console.error('❌ MongoDB Error:', err.message));
} else {
  console.warn('⚠️ MONGO_URI missing in .env');
}

app.listen(PORT, () => console.log('🚀 Server running at port:', PORT));
