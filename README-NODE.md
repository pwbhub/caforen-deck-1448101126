# Caforen Workspace — Node.js edition

Migrasi non-destruktif dari proyek statis ke server Node.js. Seluruh HTML/CSS/JS asli, fitur, dan file standalone dipertahankan. Backend baru memakai modul bawaan Node.js: **tidak perlu `npm install`** untuk menjalankan aplikasi.

## Menjalankan di VS Code

1. Ekstrak folder `caforen` dari ZIP, lalu **File → Open Folder** di VS Code.
2. Instal Node.js **20 atau lebih baru**. Cek dengan `node -v`.
3. Buka terminal VS Code di folder proyek.
4. Jalankan `npm start` (atau `npm run dev` untuk auto restart server saat `server.js` berubah).
5. Buka `http://127.0.0.1:3000/` untuk workspace.
6. Buka `http://127.0.0.1:3000/node-admin` untuk pengaturan global backend.

Pada startup pertama, jika tidak ada `.env`, server membuat password Node Admin acak **dan hanya menampilkannya sekali di terminal**. Simpan password itu. Alternatif: salin `.env.example` ke `.env` dan ganti `CAFOREN_ADMIN_PASSWORD` dengan password sendiri (minimal 12 karakter) **sebelum** menjalankan server. File `.env` tidak boleh dikomit ke git.

## Struktur

- `server.js` — HTTP static server, REST API, autentikasi Node Admin, session cookie, penulisan JSON atomik.
- `node-admin.html` — panel kontrol backend: login, edit JSON, tarik konfigurasi lokal dari browser, publish, backup.
- `data/site-config.json` — konfigurasi server yang berlaku global (diabaikan git; backup secara terpisah).
- `.env.example` — contoh environment.
- `index.html`, `pages/`, `css/`, `js/`, `standalone/` — frontend asli, tidak ditulis ulang.
- `tests/` — tes dasar Node.

## Migrasi konfigurasi dari Admin asli

1. Jalankan server, buka Workspace dan masuk ke Admin browser yang sudah ada.
2. Atur dan **Simpan & Terapkan** seperti biasa (masih disimpan di browser lokal).
3. Buka `/node-admin` **di browser dan origin yang sama** (mis. sama-sama `127.0.0.1:3000`). Login dengan **password Node Admin**.
4. Klik **Ambil draft Admin browser**, tinjau JSON, lalu **Terbitkan ke server**.
5. Klik **Hapus override lokal (browser ini)** (setelah membuat backup) supaya konfigurasi server tidak ditimpa oleh localStorage browser lama.
6. Muat ulang Workspace. Komputer lain yang mengakses server mendapat konfigurasi global terbaru.

Jika konfigurasi asli sudah pernah diekspor ke `js/data/site-config.js`, buka isinya, ambil objek `window.CA_SITE_CONFIG = {...};` (tanpa bagian `window.CA_SITE_CONFIG=`), masukkan ke editor JSON di `/node-admin`, lalu terbitkan.

## API

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/health` | GET | Status server |
| `/api/config` | GET | Konfigurasi publik tanpa `security.adminKey` |
| `/api/admin/session` | GET | Status login Node Admin |
| `/api/admin/login` | POST | Login dengan `{ "password": "..." }` |
| `/api/admin/logout` | POST | Logout |
| `/api/admin/config` | PUT | Terbitkan JSON (perlu cookie sesi Node Admin) |
| `/js/data/site-config.js` | GET | Inject konfigurasi server untuk frontend lama |

## Batasan dan keamanan

- **Login Workspace lama masih login berbasis browser, bukan autentikasi server.** Halaman utama dan aset frontend tetap publik untuk klien yang dapat mengakses alamat server. Jangan gunakan sistem tanggal login lama untuk melindungi data sensitif.
- Node Admin **terpisah** dari private key Admin lama. Mengubah private key di Konsol Admin lama tidak mengubah password backend Node.
- Fitur JavaScript/CSS kustom Admin memiliki kemampuan mengeksekusi kode browser; **terbitkan hanya konfigurasi dari admin tepercaya**.
- Konfigurasi frontend belum sinkron dua arah otomatis; publikasi memakai Node Configuration Center. Draft dan konfigurasi yang tersimpan di browser lama masih bisa menimpa versi server sampai dihapus.
- Session backend disimpan di memori sehingga logout otomatis saat server restart. Rate limiting per alamat IP disimpan di memori; untuk publik perlu reverse proxy, HTTPS, database/session store, serta autentikasi backend untuk seluruh workspace.
- Default server bind hanya ke `127.0.0.1`. Untuk akses perangkat lain di LAN, set `HOST=0.0.0.0` **hanya pada jaringan tepercaya**. Hindari mengekspos server HTTP langsung ke internet.
- News RSS, cuaca, Google Sheets, CDN, OCR, dan aset/font eksternal dari versi asli masih memerlukan internet; Node tidak menggantikan servis itu.
- `npm test` menjalankan tes unit dan smoke test dapat dilakukan dengan `curl http://127.0.0.1:3000/api/health`.

## Rekomendasi pengembangan berikutnya

1. Pindahkan sistem login workspace ke backend dengan role-based authorization dan reset/rotasi password.
2. Pindahkan draft, log dan data pekerjaan dari localStorage ke API + SQLite/PostgreSQL.
3. Integrasi sinkronisasi langsung dari tombol **Simpan & Terapkan** di Konsol Admin dengan audit trail.
4. Buat integration tests UI di browser, terutama Scene Deck, Timecode/OCR, CSV Maker.
