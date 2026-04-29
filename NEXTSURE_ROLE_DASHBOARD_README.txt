NextSure Role-Based Login + Dashboard Update

Run:
1) npm install
2) .env file e MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD set korun
3) npm start
4) open: http://localhost:5000/login.html

Default Main Admin if database e kono main admin na thake:
Email: admin@nextsure.xyz
Password: admin123

Included:
- Customer / Agency / Branch Admin / Main Admin role login
- Customer Google/Phone OTP demo login auto account create
- Agency registration with visiting card upload + Main Admin approval
- Main Admin full order view/edit, branch assign, agency/branch permission, CSV export
- Branch Admin assigned order only, discount hidden, policy PDF/policy number/MR/status update
- Agency own ID under orders, order search, PDF, payment reference update
- Customer own order view by login email/phone/user id, payment reference update
- Notifications, profile, settings UI
- Existing order form preserved. If logged in, order is saved under customer/agency token.

Important:
- Demo Google/OTP works with prompt. For real Google/OTP, configure Firebase and replace login button logic in public/js/nextsure-auth.js.
- Old MongoDB orders remain in the same orders collection. New schema is strict:false, so old fields are not deleted.
