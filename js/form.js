/* ---------------- Helper ---------------- */
function _(id){ return document.getElementById(id); }
window._lastCalc = null;

function showNotif(msg, isError=false, timeout=3000){
  const n = _('confirmation');
  n.innerText = msg;
  n.style.display = 'block';
  n.style.backgroundColor = isError ? '#fee2e2' : '#d1fae5';
  n.style.color = isError ? '#991b1b' : '#065f46';
  setTimeout(()=> n.style.display='none', timeout);
}

/* ---------------- Auto Age Band ---------------- */
function autoAgeBand(){
  const dob = _('dob').value;
  if(!dob) return;

  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();

  const m = now.getMonth() - d.getMonth();
  if(m < 0 || (m===0 && now.getDate() < d.getDate())) age--;

  let band = '0.5-40';
  if(age <= 39) band='0.5-40';
  else if(age <=49) band='41-50';
  else if(age <=64) band='51-65';
  else if(age <=69) band='66-70';
  else if(age <=74) band='71-75';
  else if(age <=78) band='76-79';
  else band='79-85';

  _('age').value = band;
}

/* ---------------- Validation ---------------- */
function validateStep1(){
  let ok=true;
  if(!_('plan').value){ _('planError').classList.remove('hidden'); ok=false; } else _('planError').classList.add('hidden');
  if(!_('dob').value){ _('dobError').classList.remove('hidden'); ok=false; } else _('dobError').classList.add('hidden');
  if(!_('days').value){ _('daysError').classList.remove('hidden'); ok=false; } else _('daysError').classList.add('hidden');
  if(parseFloat(_('multiplier').value) <= 0){ _('multiplierError').classList.remove('hidden'); ok=false; }
  else _('multiplierError').classList.add('hidden');
  return ok;
}

function validateStep2(){
  let ok=true;
  const phoneRe = /^01[0-9]{8,9}$/;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if(!_('fullName').value.trim()){ _('nameError').classList.remove('hidden'); ok=false; } else _('nameError').classList.add('hidden');
  if(!phoneRe.test(_('contact').value.trim())){ _('contactError').classList.remove('hidden'); ok=false; } else _('contactError').classList.add('hidden');
  if(!emailRe.test(_('email').value.trim())){ _('emailError').classList.remove('hidden'); ok=false; } else _('emailError').classList.add('hidden');

  return ok;
}

function validateStep3(){
  let ok=true;
  if(!_('Company').value){ _('companyError').classList.remove('hidden'); ok=false; } else _('companyError').classList.add('hidden');
  if(!_('countrySearch').value){ _('countryError').classList.remove('hidden'); ok=false; } else _('countryError').classList.add('hidden');
  if(!_('occupation').value){ _('occupationError').classList.remove('hidden'); ok=false; } else _('occupationError').classList.add('hidden');
  if(!_('address').value){ _('addressError').classList.remove('hidden'); ok=false; } else _('addressError').classList.add('hidden');
  if(!_('travelDate').value){ _('travelDateError').classList.remove('hidden'); ok=false; } else _('travelDateError').classList.add('hidden');
  if(!_('passportFile').files[0]){ _('fileError').classList.remove('hidden'); ok=false; } else _('fileError').classList.add('hidden');
  return ok;
}


/* ---------- calculate ---------- */
const rates = {
  "Plan A — Schengen (Worldwide Excl. USA & Canada)": {
      "0.5-40": {"1-14":1549,"15-21":1614,"22-28":1808,"29-35":2229,"36-47":2553,"48-60":3002,"61-75":3712,"76-90":4438,"91-120":7503,"121-147":9038,"148-180":12557},
      "41-50":  {"1-14":2324,"15-21":2479,"22-28":2767,"29-35":3341,"36-47":3830,"48-60":4537,"61-75":5600,"76-90":6639,"91-120":11330,"121-147":13586,"148-180":18741},
      "51-65":  {"1-14":3124,"15-21":3330,"22-28":3719,"29-35":4491,"36-47":5148,"48-60":6099,"61-75":7528,"76-90":8926 ,"91-120":15230,"121-147":18267,"148-180":25407},
      "66-70":  {"1-14":10164,"15-21":10836,"22-28":12098,"29-35":14617,"36-47":16753,"48-60":19842,"61-75":24498,"76-90":29040},
      "71-75":  {"1-14":17788,"15-21":18962,"22-28":21170,"29-35":25578,"36-47":29318,"48-60":34724,"61-75":42871,"76-90":50820},
      "76-79":  {"1-14":35574,"15-21":37924,"22-28":42340,"29-35":51157,"36-47":58636,"48-60":69448, "61-75":85743, "76-90":101640},
      "80-85":  {"1-14":50820, "15-21":54178,"22-28":60486,"29-35":73080,"36-47":83764,"48-60":99211}
    },
    "Plan B — Schengen (Worldwide Incl. USA & Canada)": {
      "0.5-40":{"1-14":2837,"15-21":3013,"22-28":3406,"29-35":4090,"36-47":4877,"48-60":7856,"61-75":11296,"76-90":13593,"91-120":19150,"121-147":25428,"148-180":33674},
      "41-50":{"1-14":5250,"15-21":5623,"22-28":6516,"29-35":7687,"36-47":9372,"48-60":15228,"61-75":22022,"76-90":26473,"91-120":37486,"121-147":54623,"148-180":66257},
      "51-65":{"1-14":6664,"15-21":7140,"22-28":8272,"29-35":9760,"36-47":11900,"48-60":19338,"61-75":27966,"76-90":33618 ,"91-120":47600,"121-147":63368,"148-180":84134},
      "66-70":{"1-14":21686,"15-21":23233,"22-28":26914,"29-35":31754,"36-47":38722,"48-60":62923,"61-75":90994,"76-90":109390},
      "71-75":{"1-14":37960,"15-21":40659,"22-28":47100,"29-35":55570,"36-47":67763,"48-60":110117,"61-75":159240,"76-90":191431},
      "76-79":{"1-14":75899,"15-21":81318,"22-28":94200,"29-35":111139,"36-47":135528,"48-60":220233,"61-75":318480,"76-90":382863},
      "80-85":{"1-14":108427,"15-21":116168,"22-28":134571,"29-35":158769,"36-47":193611,"48-60":314619}
    },
    "Plan A — Non—Schengen (Worldwide Excl. USA & Canada)": {
      "0.5-40":{"1-14":1239,"15-21":1291,"22-28":1446,"29-35":1783,"36-47":2042,"48-60":2402,"61-75":2970,"76-90":3550,"91-120":6003,"121-147":7230,"148-180":10046},
      "41-50": {"1-14":1860,"15-21":1983,"22-28":2213,"29-35":2673,"36-47":3063,"48-60":3629,"61-75":4480,"76-90":5311 ,"91-120":9063,"121-147":10869,"148-180":14992},
      "51-65": {"1-14":2499,"15-21":2664,"22-28":2976,"29-35":3592,"36-47":4119,"48-60":4879,"61-75":6022,"76-90":7140 ,"91-120":12184,"121-147":14613,"148-180":20326},
      "66-70": {"1-14":8131,"15-21":8668,"22-28":9678,"29-35":11692,"36-47":13402,"48-60":15873,"61-75":19598,"76-90":23232 },
      "71-75": {"1-14":14230,"15-21":15169,"22-28":16937,"29-35":20462,"36-47":23454,"48-60":27779,"61-75":34297,"76-90":40657 },
      "76-79": {"1-14":28460,"15-21":30338,"22-28":33873,"29-35":40924,"36-47":46908,"48-60":55558,"61-75":68592,"76-90":81312 },
      "80-85": {"1-14":40457 ,"15-21":43339,"22-28":48390,"29-35":58463,"36-47":67011,"48-60":79368,}
    },
    "Plan B — Non—Schengen (Worldwide Incl. USA & Canada)": {
      "0.5-40":{"1-14":2269,"15-21":2411,"22-28":2724,"29-35":3271,"36-47":3901,"48-60":6284,"61-75":9037,"76-90":10874,"91-120":15320,"121-147":20341,"148-180":26939},
      "41-50": {"1-14":4200,"15-21":4499,"22-28":5212,"29-35":6149,"36-47":7497,"48-60":12182,"61-75":17910,"76-90":21178,"91-120":29988,"121-147":39921,"148-180":53006},
      "51-65": {"1-14":5331,"15-21":5712,"22-28":6618,"29-35":7808,"36-47":9520,"48-60":15470,"61-75":22371,"76-90":26894,"91-120":38080,"121-147":50694,"148-180":67308},
      "66-70": {"1-14":17349,"15-21":18587,"22-28":21531,"29-35":25402,"36-47":30977,"48-60":50339,"61-75":72796,"76-90":87511},
      "71-75": {"1-14":30360,"15-21":32526,"22-28":37679,"29-35":44454,"36-47":54210,"48-60":88093,"61-75":127392,"76-90":153146},
      "76-79": {"1-14":60720,"15-21":65052,"22-28":75358,"29-35":88910,"36-47":108420,"48-60":176187,"61-75":254784,"76-90":306291},
      "80-85": {"1-14":86742, "15-21":92931,"22-28":107653,"29-35":127013,"36-47":154886,"48-60":251694}
    },
    "Plan C — Study (Excl. USA & Canada) Schengen": {"0.5-40":{"6month":13956,"12month":27912},"41-50":{"6month":21072,"12month":42144}},
    "Plan D — Study (Incl. USA & Canada) Schengen": {"0.5-40":{"6month":22470,"12month":44940},"41-50":{"6month":42498,"12month":84996}},
    "Plan C — Study (Excl. USA & Canada) Non—Schengen": {"0.5-40":{"6month":11166,"12month":22332},"41-50":{"6month":16860,"12month":33720}},
    "Plan D — Study (Incl. USA & Canada) Non—Schengen": {"0.5-40":{"6month":17976,"12month":35952},"41-50":{"6month":34002,"12month":68004}}
  };

  function calculatePrice(){
  if(!validateStep1()){ showNotif('⚠️ Step 1 ভুল আছে — ঠিক করে আবার চেষ্টা করুন', true); return; }
  const plan = _('plan').value, age=_('age').value, days=_('days').value;
  const multiplier = Math.max(0.01, parseFloat(_('multiplier').value || 1));
  const adminDiscount = parseFloat(_('adminDiscount').value || 0);

  const base = rates[plan]?.[age]?.[days];
  if(base === undefined){ _('result').classList.remove('hidden'); _('result').innerHTML = '<div class="text-red-600 font-semibold">Rate not found for this combination.</div>'; _('toStep2Btn').classList.add('hidden'); window._lastCalc = null; return; }

  const baseNet = parseFloat(base);
  const net = +(baseNet * multiplier); // Apply multiplier
  const vat = +(net * 0.15);
  const gross = +(net + vat);
  const specialDiscountAmount = +(net * (adminDiscount/100));
  const discountNet = +(net - specialDiscountAmount);
  const totalPayable = +(discountNet + vat);

  _('result').classList.remove('hidden');
  _('result').innerHTML = `
    <div class="text-gray-800"><strong>Base Net Premium:</strong> ৳${baseNet.toFixed(2)}</div>
    <div class="text-gray-800"><strong>VAT (15%):</strong> ৳${vat.toFixed(2)}</div>
    <div class="text-gray-800"><strong>Total Gross (x ${multiplier}):</strong> ৳${gross.toFixed(2)}</div>
    <div class="text-gray-800"><strong>Net after discount:</strong> ৳${discountNet.toFixed(2)}</div>
    <div class="text-red-500"><strong>Discount:</strong> -৳${specialDiscountAmount.toFixed(2)} (${adminDiscount}%)</div>

    <div class="mt-2 text-indigo-700 font-bold text-lg"><strong>Total Payable:</strong> ৳${totalPayable.toFixed(2)}</div>
  `;
  _('toStep2Btn').classList.remove('hidden');

  window._lastCalc = { plan, age, days, multiplier, adminDiscount, baseNet, gross, specialDiscountAmount, discountNet, vat, totalPayable };
}
/* ---------- clear ---------- */
function clearStep1(){
  _('plan').value = '';
  _('dob').value = '';
  _('age').value = '0.5-40';
  _('days').value = '';
  _('multiplier').value = '1';
  _('adminDiscount').value = '0';
  _('result').classList.add('hidden');
  _('toStep2Btn').classList.add('hidden');
  window._lastCalc = null;
  ['planError','dobError','daysError','multiplierError'].forEach(id=>_(id).classList.add('hidden'));
}

/* ---------------- Step Control ---------------- */
function setActiveStep(n){
  ['s1','s2','s3'].forEach((id,i)=>{
    const el = _(id);
    if(i+1===n){ el.classList.add('active'); el.style.background='#4338ca'; el.style.color='#fff'; }
    else { el.classList.remove('active'); el.style.background='#f3f4f6'; el.style.color='#374151'; }
  });

  _('step1').classList.toggle('hidden', n!==1);
  _('step2').classList.toggle('hidden', n!==2);
  _('step3').classList.toggle('hidden', n!==3);
}

/* ---------------- Calculate ---------------- */
// ⚠️ তোমার rates object আগের মতোই রাখলাম — copy করার দরকার নেই

function calculatePrice(){
  if(!validateStep1()){ showNotif('⚠️ Step 1 ভুল আছে', true); return; }

  const plan = _('plan').value;
  const age = _('age').value;
  const days = _('days').value;
  const multiplier = Math.max(0.01, parseFloat(_('multiplier').value || 1));
  const adminDiscount = parseFloat(_('adminDiscount').value || 0);

  const base = rates[plan]?.[age]?.[days];
  if(!base){
    _('result').innerHTML = '<div class="text-red-600">Rate not found</div>';
    _('result').classList.remove('hidden');
    return;
  }

  const baseNet = base;
  const net = baseNet * multiplier;
  const vat = net * 0.15;
  const gross = net + vat;
  const discount = net * (adminDiscount/100);
  const discountNet = net - discount;
  const totalPayable = discountNet + vat;

  _('result').innerHTML = `
    <div>Base Net: ৳${baseNet}</div>
    <div>Total Payable: <b>৳${totalPayable}</b></div>
  `;
  _('result').classList.remove('hidden');
  _('toStep2Btn').classList.remove('hidden');

  window._lastCalc = {plan, age, days, multiplier, adminDiscount, baseNet, gross, discount, discountNet, vat, totalPayable};
}

/* ---------------- Go to Step ---------------- */
function goToStep(n){
  if(n===2 && !window._lastCalc){ showNotif('⚠️ প্রথমে Calculate করুন', true); return; }
  if(n===3 && !validateStep2()){ showNotif('⚠️ Step2 ভুল আছে', true); return; }
  setActiveStep(n);
}

/* ---------------- FINAL ORDER SUBMIT ---------------- */
async function confirmOrder(){
  if(!validateStep3()){
    showNotif("⚠️ Step3 ভুল আছে", true);
    return;
  }

  const orderId = "NS" + Math.floor(100000 + Math.random()*900000);

  const fd = new FormData();
  fd.append("orderId", orderId);
  fd.append("customerName", _('fullName').value.trim());
  fd.append("contact", _('contact').value.trim());
  fd.append("email", _('email').value.trim());
  fd.append("dob", _('dob').value);
  fd.append("company", _('Company').value);
  fd.append("country", _('countrySearch').value);
  fd.append("occupation", _('occupation').value);
  fd.append("address", _('address').value);
  fd.append("travelDate", _('travelDate').value);
  fd.append("calc", JSON.stringify(window._lastCalc));
  fd.append("passportFile", _('passportFile').files[0]);

  try{
    const res = await fetch("https://api.nextsure.xyz/api/save-order", {
      method: "POST",
      body: fd
    });

    const j = await res.json();

    if(j.success){
      showNotif("✅ Order Confirmed! Order ID: " + orderId, false, 4000);
    } else {
      showNotif("❌ Order Save হয়নি", true);
    }

  } catch(e){
    console.error(e);
    showNotif("❌ Network Error — আবার চেষ্টা করুন", true);
  }
}
async function confirmOrder() {
  // ১. ভ্যালিডেশন চেক (আপনার আগের কোড অনুযায়ী)
  if (!validateStep3()) {
    showNotif("⚠️ Step3 ভুল আছে", true);
    return;
  }

  // ২. ফর্ম থেকে কাস্টমারের ইমেইল এবং নাম সংগ্রহ করা
  const customerEmail = _('email').value.trim(); // HTML input id='email' থেকে নিচ্ছে
  const customerName = _('fullName').value.trim(); // HTML input id='fullName' থেকে নিচ্ছে
  const orderId = "NS" + Math.floor(100000 + Math.random() * 900000);

  // ৩. ফায়ারস্টোরে ডেটা পাঠানো (যাতে এক্সটেনশনটি মেইল পাঠাতে পারে)
  // এখানে 'db' আপনার Firestore ডিক্লেয়ারেশন ভেরিয়েবল
  db.collection("mail").add({
    to: customerEmail, // এখানে কাস্টমারের দেওয়া ইমেইল অটোমেটিক বসে যাবে
    message: {
      subject: "Order Confirmation - NextSure",
      text: `প্রিয় ${customerName}, আপনার অর্ডারটি (ID: ${orderId}) সফলভাবে গ্রহণ করা হয়েছে।`,
      html: `
        <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px;">
          <h2 style="color: #4338ca;">ধন্যবাদ, ${customerName}!</h2>
          <p>আপনার অর্ডারটি সফলভাবে সাবমিট হয়েছে।</p>
          <p><b>অর্ডার আইডি:</b> ${orderId}</p>
          <p>আমরা শীঘ্রই আপনার সাথে যোগাযোগ করবো।</p>
          <hr>
          <small>এটি একটি অটো-জেনারেটেড মেইল।</small>
        </div>
      `
    }
  })
  .then((docRef) => {
    console.log("Mail document created with ID: ", docRef.id);
    showNotif("✅ অর্ডার এবং ইমেইল সফলভাবে পাঠানো হয়েছে!", false);
  })
  .catch((error) => {
    console.error("Error sending mail: ", error);
    showNotif("❌ মেইল পাঠাতে সমস্যা হয়েছে", true);
  });
}

// _('confirmOrderBtn').addEventListener("click", confirmOrder);
// document.addEventListener("DOMContentLoaded", ()=> setActiveStep(1));

// // Firestore-এ 'mail' কালেকশনে ডেটা পাঠানোর কোড
// fd.collection("mail").add({
//     to: "user@example.com", // যাকে মেইল পাঠাতে চান
//     message: {
//         subject: "Order Confirmation",
//         text: "আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।",
//         html: "<b>ধন্যবাদ!</b> আপনার অর্ডারটি প্রসেস করা হচ্ছে।"
//     }
// })
// .then((docRef) => {
//     console.log("Document written with ID: ", docRef._id);
//     alert("অর্ডার কনফার্ম হয়েছে এবং মেইল পাঠানো হয়েছে!");
// })
// .catch((error) => {
//     console.error("Error adding document: ", error);
// });

// // ফর্ম থেকে ডেটা নিন
// const customerName = document.getElementById('name').value;
// const contact = document.getElementById('phone').value;

// // Firestore-এ ডেটা অ্যাড করুন
// fd.collection("mail").add({
//   to: "example@email.com", // এখানে আসল email দিতে হবে
//   message: {
//     subject: "Order Confirmation",
//     text: `কাস্টমারের নাম: ${customerName}, ফোন নম্বর: ${contact}`,
//     html: `<p>কাস্টমারের নাম: <b>${customerName}</b>, ফোন নম্বর: <b>${contact}</b></p>`
//   }
// })
// .then((docRef) => {
//   console.log("Document written with ID: ", docRef._id);
//   alert("অর্ডার কনফার্ম হয়েছে এবং ডেটা পাঠানো হয়েছে!");
// })
// .catch((error) => {
//   console.error("Error adding document: ", error);
// });
