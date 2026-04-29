
text/x-generic server.js ( UTF-8 Unicode text, with CRLF line terminators )
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= FIREBASE ADMIN =================
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
});

// ================= FILE UPLOAD =================
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});

const upload = multer({ storage });
app.use("/uploads", express.static("uploads"));

// ================= DATABASE =================
mongoose
  .connect(process.env.MONGO_URI, { dbName: "nextsure" })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// ================= MODELS =================
const userSchema = new mongoose.Schema({
  uid: String,
  email: String,
  role: { type: String, default: "customer" },
  agentId: String,
});
const User = mongoose.model("User", userSchema);

const orderSchema = new mongoose.Schema(
  {
    orderId: String,
    customerId: String,
    agentId: String,
    amount: Number,
    status: { type: String, default: "Pending" },
    passportFile: String,
  },
  { timestamps: true }
);
const Order = mongoose.model("Order", orderSchema);

// ================= EMAIL CONFIG =================
const transporter = nodemailer.createTransport({
  host: "mail.nextsure.xyz",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

// ================= AUTH MIDDLEWARE =================
async function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send("No token");

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).send("Invalid token");
  }
}

// ================= USER =================
app.post("/api/save-user", async (req, res) => {
  const { uid, email, role } = req.body;

  let user = await User.findOne({ uid });

  if (!user) {
    user = new User({
      uid,
      email,
      role,
      agentId: role === "agent" ? "AGT" + Date.now() : null,
    });
    await user.save();
  }

  res.json(user);
});

app.get("/api/me", auth, async (req, res) => {
  const user = await User.findOne({ uid: req.user.uid });
  res.json(user);
});

// ================= ORDER CREATE =================
app.post("/api/save-order", auth, upload.single("passportFile"), async (req, res) => {
  try {
    const order = new Order({
      orderId: "ORD" + Date.now(),
      customerId: req.user.uid,
      amount: req.body.amount,
      passportFile: req.file ? "/uploads/" + req.file.filename : null,
    });

    await order.save();

    // ✅ EMAIL SEND (FIXED)
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: req.user.email,
      subject: "Order Confirmation - NextSure",
      html: `
        <h2>Order Placed Successfully</h2>
        <p><b>Order ID:</b> ${order.orderId}</p>
        <p><b>Amount:</b> ${order.amount}</p>
      `,
    });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= GET ORDERS =================
app.get("/api/orders", auth, async (req, res) => {
  const user = await User.findOne({ uid: req.user.uid });

  if (user.role === "admin") return res.json(await Order.find());
  if (user.role === "agent")
    return res.json(await Order.find({ agentId: req.user.uid }));

  return res.json(await Order.find({ customerId: req.user.uid }));
});

// ================= ASSIGN AGENT =================
app.post("/api/assign-agent", auth, async (req, res) => {
  const user = await User.findOne({ uid: req.user.uid });

  if (user.role !== "admin")
    return res.status(403).send("Only admin allowed");

  const { orderId, agentId } = req.body;

  const updated = await Order.findOneAndUpdate(
    { orderId },
    { agentId },
    { new: true }
  );

  res.json(updated);
});

// ================= UPDATE STATUS =================
app.post("/api/update-status", auth, async (req, res) => {
  const { orderId, status } = req.body;

  const updated = await Order.findOneAndUpdate(
    { orderId },
    { status },
    { new: true }
  );

  res.json(updated);
});

// ================= DELETE ORDER =================
app.post("/api/delete-order", auth, async (req, res) => {
  const user = await User.findOne({ uid: req.user.uid });

  if (user.role !== "admin")
    return res.status(403).send("Only admin");

  await Order.findOneAndDelete({ orderId: req.body.orderId });

  res.json({ success: true });
});

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("NextSure Server Running 🚀");
});
<!-- FIREBASE -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"></script>

<script>
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// 🔐 AUTH CHECK
auth.onAuthStateChanged(async (user)=>{
  if(user){
    const token = await user.getIdToken();
    localStorage.setItem("token", token);
    loadOrders();
  }else{
    window.location.href="login.html";
  }
});

// 📦 LOAD ORDERS FROM SERVER
async function loadOrders(){
  const token = localStorage.getItem("token");

  const res = await fetch("http://localhost:5000/api/orders",{
    headers:{ Authorization: token }
  });

  const data = await res.json();

  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "";

  let total = 0;

  data.forEach((o,i)=>{
    total += o.amount || 0;

    tbody.innerHTML += `
      <tr>
        <td>${i+1}</td>
        <td>${new Date(o.createdAt).toLocaleString()}</td>
        <td>${o.orderId}</td>
        <td>${o.customerName || "-"}</td>
        <td>${o.address || "-"}</td>
        <td>${o.company || "-"}</td>
        <td>${o.plan || "-"}</td>
        <td>${o.dob || "-"}</td>
        <td>${o.age || "-"}</td>
        <td>${o.duration || "-"}</td>
        <td>${o.country || "-"}</td>
        <td>${o.occupation || "-"}</td>
        <td>${o.travelDate || "-"}</td>
        <td>${o.contact || "-"}</td>
        <td>${o.email || "-"}</td>
        <td>${o.multiplier || "-"}</td>
        <td>${o.offer || "-"}</td>
        <td>৳${o.amount || 0}</td>
        <td>${o.status}</td>
        <td>
          <button onclick="updateStatus('${o.orderId}')">Update</button>
        </td>
      </tr>
    `;
  });

  // stats update
  if(document.getElementById("totalOrders")){
    document.getElementById("totalOrders").innerText = data.length;
  }
}

// 🔄 UPDATE STATUS
async function updateStatus(orderId){
  const token = localStorage.getItem("token");

  const status = prompt("Enter: Pending / Approved / Cancel");

  await fetch("http://localhost:5000/api/update-status",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      Authorization: token
    },
    body: JSON.stringify({orderId,status})
  });

  loadOrders();
}

// 🚪 LOGOUT
function logout(){
  auth.signOut();
}
</script>
// ================= START SERVER =================
app.listen(PORT, () => {
  console.log("Server running on port:", PORT);
});
