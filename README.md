# MiseVerse

1. Buka console.firebase.google.com, buat project.
2. Authentication > Sign-in method: aktifkan **Email/Password** dan **Google**.
3. Firestore Database: buat database, lalu tempel isi `firestore.rules` di tab Rules dan Publish.
4. Project settings > Your apps > Web: salin config ke `firebase-config.js`.
5. Upload semua file ke GitHub, lalu hubungkan ke Netlify (tanpa build command, publish directory `/`).
6. Authentication > Settings > Authorized domains: tambahkan domain Netlify kamu.

Catatan: login "nama + password" memakai email palsu `nama@tukar.app` di belakang layar.
File disimpan di HP masing-masing (IndexedDB); folder, status privat/publik, dan akun disimpan di Firebase.
