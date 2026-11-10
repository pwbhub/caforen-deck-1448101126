CONTENT ANALYST DRAFT — Workspace terpadu
=========================================
Cara pakai: ekstrak ZIP, lalu buka index.html (klik dua kali) di Chrome / Edge / Firefox terbaru.
Semua halaman melewati gerbang login di index.html (membuka file di pages/ langsung akan dialihkan ke login).
Tidak perlu server atau instalasi. Koneksi internet dibutuhkan untuk: jadwal Google Sheets,
berita RSS, cuaca Open-Meteo, font Google, dan mesin OCR Tesseract (Timecode).

Struktur
  index.html            Halaman utama: gerbang login + shell (header, menu, berita/cuaca, Live Shift, screensaver)
  pages/                home, shift-live, timecode, hotspot, csv-maker, scene-deck, admin (Konsol Admin)
  css/base.css          Token desain & komponen bersama (tema terang/gelap)
  css/shell.css         Gaya header & layar transisi
  css/gate.css          Gerbang login, badge peran, sign out, pengumuman, aksi screensaver
  css/saver.css         Animasi screensaver per state (login, User, Admin, terkunci)
  css/pages/*.css       Gaya per halaman (admin.css = Konsol Admin)
  js/core/sha256.js     SHA-256 murni (dipakai untuk hash private key)
  js/core/auth.js       Login User/Admin, sesi bertanda tangan, penguncian percobaan, log aktivitas
  js/core/config.js     Konfigurasi tampilan (bawaan ← site-config.js ← perubahan Admin) + riwayat versi
  js/core/apply.js      Penerap konfigurasi: warna, CSS/JS kustom, penggantian nama elemen
  js/core/embed.js      Penghubung halaman–shell (+ terima konfigurasi, mode pilih elemen)
  js/core/shift-core.js Logika jadwal
  js/shell/             shell, gate (login), ticker, news, weather, live-ticker
  js/pages/             skrip tiap halaman (+ mesin PPTX Scene Deck, admin.js)
  js/data/admin-roadmap.js Daftar rekomendasi fungsi lanjutan per menu (Konsol Admin)
  js/data/site-config.js Konfigurasi bersama hasil ekspor Admin (kosong = tampilan bawaan)
  js/data/              snapshot warna M, ikon cuaca, template PPTX bawaan
  js/vendor/            JSZip 3.10.1

Pintasan: Alt+1..9 pindah menu · Alt+T ganti tema · Alt+L kunci/screensaver · Ctrl+S simpan (Konsol Admin)
          · Ctrl+V tempel gambar (Timecode/Hotspot)

Pembaruan versi 2
  - Scene Deck: ringkasan slide 2 memakai "MINS" untuk durasi, "S" untuk detik
    (Total, Outdoor, Indoor, Key Logo); nilai 0 ditampilkan "-". Tombol "Mulai ulang".
  - Pindah menu instan; screensaver hanya muncul saat tidak ada aktivitas (45 detik).
  - Ticker Live Shift tetap berjalan setelah sinkron; berhenti sejenak hanya saat kursor di atasnya.
  - Header: tombol Creator (WhatsApp) & Donate (Saweria); di ponsel menu pindah ke navigasi bawah.

Pembaruan versi 3
  - Beranda: mini browser YouTube diganti "Feed berita terkini" — kartu bergambar + ringkasan
    dari RSS Detik, Tempo, CNN Indonesia, ANTARA, Suara, CNBC Indonesia, Okezone.
    Fokus Jakarta (bisa dimatikan), filter per media, terbaru di atas, refresh otomatis 10 menit.

Pembaruan versi 4 — Login, Konsol Admin, CSV Maker baru
  LOGIN (index.html)
  - User  : ketik tanggal hari ini (tanggal, bulan, tahun). Format bebas: 23-10-2026, 23/10/2026,
            23102026, 23 10 2026, 23 Oktober 2026, 2026-10-23. Sesi User berakhir saat tanggal berganti.
  - Admin : private key. Kunci TIDAK tersimpan sebagai teks di kode — hanya hash SHA-256 bergaram
            (4096 putaran) yang dipecah & diacak. Admin bisa mengganti kunci di Konsol Admin.
  - Salah input: peringatan di form, kartu bergetar, sisa percobaan, peringatan bersama di atas form,
    dan form dikunci sementara (bawaan 5x salah → 30 detik). Percobaan gagal ditampilkan lagi
    sebagai peringatan setelah login berikutnya, dan tercatat di Log Aktivitas.
  - Setiap peran punya badge (USER/ADMIN) dan tombol Sign out di header.

  SCREENSAVER & SESI
  - Muncul setelah tidak ada aktivitas (bawaan 45 detik) — juga di halaman login.
  - Berisi tombol Lanjutkan & Sign out serta hitung mundur sign out otomatis
    (bawaan User 30 menit, Admin 15 menit; bisa diubah / dimatikan).
  - Sesi Admin terkunci saat screensaver: hanya terbuka dengan private key (salah berulang = sign out paksa).

  KONSOL ADMIN (menu "Admin", hanya untuk Admin)
  - Identitas & Teks : nama aplikasi, logo, judul tab, teks login, teks screensaver, pengumuman, tautan.
  - Menu             : ganti nama/ikon/judul/warna menu, urutkan, sembunyikan dari User, menu pembuka.
  - Warna & Font     : preset tema, 8 warna aksen, warna tema terang/gelap, font, sudut kartu.
  - Nama Elemen      : klik elemen di preview → ganti teks/placeholder/tooltip/sembunyikan/gaya.
  - Script & CSS     : CSS & JavaScript kustom untuk Shell, semua halaman, atau per halaman
                       (cek sintaks, contoh siap sisip, jalankan di preview).
  - CSV Maker        : daftar awalan UID, mode yang tersedia, mode pembuka, jumlah klip & timecode awal.
  - Sesi & Keamanan  : waktu screensaver, sign out otomatis, kunci sesi, batas percobaan, ganti private key.
  - Log Aktivitas    : login, gagal, buka kunci, sign out, simpan; filter & ekspor CSV.
  - Cadangan & Rilis : 15 versi otomatis + pulihkan, ekspor/impor JSON, unduh site-config.js.
  Semua perubahan dicoba dulu di preview (draft), lalu "Simpan & terapkan" → langsung tampil di User.

  AGAR PERUBAHAN ADMIN SAMPAI KE KOMPUTER LAIN
  Perubahan disimpan di browser tempat Admin bekerja. Untuk komputer lain: Konsol Admin →
  Cadangan & Rilis → "Unduh site-config.js" → timpa js/data/site-config.js → bagikan ulang folder ini.

  CSV MAKER (pembaruan CSVUPDATE)
  - Mode 01 Original · 02 Advance (awalan dari angka akhir UID) · 03 Legacy (input manual).
  - Status ekspor W/R langsung, preview CSV W & J/R, simpan PNG, preview sheet siap salin (W, R, W+R).
  - Draft form tersimpan otomatis; tombol "Kosongkan form".

  CATATAN KEAMANAN
  Ini aplikasi statis; gerbang login berjalan di browser. Untuk publikasi di internet, tambahkan
  autentikasi di web server (Basic Auth/SSO). Private key Admin dibagikan terpisah, tidak ditulis di file mana pun.

Pembaruan versi 5 — Scene Deck v3, Data & Rekomendasi, screensaver animasi
  SCENE DECK (dipindahkan dari content-analyst-v3)
  - TCR IN & TCR OUT satu baris (spasi tak-putus agar pasangan tidak terpotong).
  - Embed Type: Signage Billboard, Building Wrap, Vehicle Wrap, Store Front, Poster, Trailer,
    Table Talker, Product/Calendar/Book Placement + KEY LOGO (khusus). Jenis lama tetap terbaca.
  - Ringkasan exposure: pratinjau seluruh slide (cover, ringkasan, scene, penutup) dengan ‹ ›,
    panah keyboard, Home/End, dan daftar slide; logo slide penutup diambil dari template.
  - Baru: Konsol Admin → Scene Deck untuk menyembunyikan/menambah Embed Type dan memilih
    jenis bawaan scene baru (jenis yang disembunyikan tetap sah untuk draft lama).

  KONSOL ADMIN → DATA & REKOMENDASI
  - Data penggunaan: berapa kali tiap menu dibuka & lama dipakai, grafik 14 hari, jumlah
    ekspor (CSV W/R, salin sheet, PPTX), filter per peran, ekspor CSV.
  - Saran adaptif yang bisa diterapkan sekali klik (menu pembuka, urutan tab sesuai pemakaian,
    sembunyikan menu tak terpakai, penguncian login, batas sign out).
  - 23 rekomendasi fungsi lanjutan per menu (Lintas menu, Beranda, Shift Live, Timecode, Hotspot,
    CSV Maker, Scene Deck, Admin) lengkap dengan alur data, langkah teknis, prioritas, ukuran kerja;
    Admin dapat memberi status & catatan lalu mengekspor roadmap CSV.

  SCREENSAVER BERANIMASI DI SEMUA STATE
  - Login (lime), User (mint), Admin (koral), Terkunci (merah + gembok & garis pindai).
  - Partikel naik, cincin berputar, lencana state memantul, jam besar berdetak, judul bergelombang,
    timer sign out melingkar. Admin dapat memilih Penuh / Lembut / Statis dan mencobanya langsung.
  - Menu terakhir diingat per peran (login Admin selalu kembali ke Konsol Admin).

Pembaruan versi 5.1 — File standalone per menu
  Folder standalone/ berisi satu file HTML utuh untuk setiap menu (kecuali Beranda):
    shift-live.html · timecode.html · hotspot.html · csv-maker.html · scene-deck.html
  - Seluruh CSS, JavaScript, data, dan template PPTX sudah di dalam file — cukup buka/bagikan satu file.
  - Header (jam, Creator/Donate, tema), strip BERITA + cuaca, dan strip LIVE SHIFT tetap tampil.
  - Screensaver beranimasi (warna mengikuti menu). Alt+T ganti tema, Alt+L tampilkan screensaver.
  - Tanpa login & tanpa konfigurasi Admin; data lokal (draft, mode, dll.) diberi awalan "sa-<menu>:"
    sehingga tidak bercampur dengan program utama.
  - Internet tetap diperlukan untuk berita, cuaca, jadwal Google Sheets, font, dan OCR (Timecode).
  - Membuat ulang setelah mengubah program: python3 tools/build-standalone.py
  Perbaikan: nama file PPTX Scene Deck kini mengganti tanda "—" menjadi "-" agar tidak berubah
  menjadi "download" di sebagian sistem.

Pembaruan versi 6
  BERANDA
  - Bagian "Fungsi setiap menu" dan "Apa yang baru" dihapus. Beranda kini hanya berisi
    Live di semua departemen (jadwal shift) dan Feed berita terkini (RSS).
  CSV MAKER
  - Panel cepat (header mini) di sisi kanan yang tetap menempel saat halaman digulir:
    status ekspor W/R (berubah warna: hijau siap · kuning sebagian · merah periksa),
    hasil/kesalahan ekspor CSV terakhir, mode & jumlah klip aktif, status draft,
    tombol "Kosongkan form", dan tombol gulir ↑ / ↓ dengan indikator posisi halaman.
  - Layar < 1180 px: panel menjadi bar menempel di atas; di ponsel tersusun ringkas.
  SCENE DECK
  - Informasi utama tersusun per baris: 01 Informasi utama ↔ pratinjau slide cover,
    02 Detail program ↔ pratinjau slide ringkasan (LIVE). Tombol "Lihat semua slide"
    membuka penampil Ringkasan exposure langsung di slide 2.
  - Tambah scene tidak lagi menggulir halaman: fokus tetap di tombol Tambah scene
    sehingga bisa diklik berulang; scene baru disorot sebentar + notifikasi jumlah.
  - Embed Type baru: TVC Placement dan Screen Replacement (juga di Konsol Admin → Scene Deck).
  STANDALONE
  - Folder standalone/ dibuat ulang dari versi ini (tanpa login User/Admin):
    python3 tools/build-standalone.py
