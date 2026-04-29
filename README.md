NextSure — Ready-to-run project

Steps:
1. Copy .env.example to .env and set MONGO_URI (your Atlas connection string) and ADMIN_PASS.
2. npm install
3. npm start
4. Open:
   - http://localhost:5000/form.html
   - http://localhost:5000/dashboard.html

NextSure — Firebase Secure Login


Files:
- public/login.html # Login page (Email/Password, Google, Phone OTP)
- public/dashboard.html # Dashboard (protected)
- public/auth.js # Auth logic + Firebase init
- public/firebase-config.example.js # Example config (replace with your own)


Setup steps:
1. Create Firebase project at https://console.firebase.google.com/
2. Enable Authentication providers: Email/Password, Google, and Phone.
3. Add your domain (nextsure.xyz) to Authorized domains in Firebase Console.
4. Replace firebase-config.example.js contents with your project's config.
5. Deploy static files to your hosting (cPanel/Shared/Netlify/Vercel)


Security notes:
- For production, consider using Firebase Rules, and server-side session verification if required.