# Anindita Creative — Frontend & Dashboard System

Implementasi Frontend dan Dashboard manajemen pesanan untuk **Anindita Creative** (Creative Agency Berbasis Project), dibuat 100% presisi sesuai desain UI referensi dan telah disiapkan secara menyeluruh untuk diintegrasikan dengan backend.

---

## 📸 Halaman & Desain UI yang Telah Selesai 100%

1. **Profil / Landing Page (`index.html`)**
   - *Referensi Desain*: `landing-page/Profil/Profil (Desktop 1440).png`
   - Tipografi serif elegan wordmark `anindita` (Playfair Display) dipadukan dengan Plus Jakarta Sans.
   - Hero section dengan tag pill `CREATIVE AGENCY BERBASIS PROJECT`, headline berdampak tinggi, statistik (150+ Project, 60+ Klien, 5 Layanan), dan 4 kartu video showcase bertema bronze metallic gradient dengan play button.
   - Ribbon / Ticker strip horizontal bergerak halus.
   - Bagian **Layanan Kami**: 6 kartu layanan lengkap dengan icon, harga awal, dan tombol `+ Tambah` yang langsung terhubung ke keranjang.
   - Bagian **Portofolio**: Filter kategori interaktif (*Semua, Edit Video, Edit Feed, Videographer, 3D*) dan 6 item portofolio.
   - Bagian **Tentang Kami**: 4 poin pilar layanan (*Fokus pada project, Tepat waktu, Revisi transparan, Satu tim banyak layanan*).
   - Bagian **Proses Kerja**: 4 tahapan alur kerja bertema gelap (*Konsultasi, Pilih & checkout, Produksi & revisi, Hasil dikirim*).
   - Bagian **Testimoni**: Ulasan klien dengan rating 5 bintang emas.
   - Banner CTA gelap dan Footer lengkap.

2. **Cart Drawer Overlay (`index.html` + `css/style.css` + `js/cart.js`)**
   - *Referensi Desain*: `landing-page/Card-drawer/03 Cart Drawer (Overlay).png`
   - Slide-over drawer dari sisi kanan dengan efek backdrop blur.
   - Header dinamis `Keranjang (N)` dan tombol tutup `✕`.
   - Kartu item keranjang dengan thumbnail gradien bronze, judul, paket, format harga `Qty X • Rp XXX.XXX`, dan icon tempat sampah untuk menghapus item.
   - Subtotal otomatis terhitung secara realtime.
   - Tombol `Lanjut ke Checkout` dan tombol hijau `Pesan Cepat via WhatsApp`.

3. **Halaman Checkout & Detail Project (`checkout.html`)**
   - *Referensi Desain*: `landing-page/Checkout/02 Checkout (Desktop 1440).png`
   - Navbar atas dengan tombol `← Kembali ke Beranda` dan badge `Checkout aman via WhatsApp`.
   - Stepper navigasi: `(✓) Keranjang` — `(2) Detail project` (aktif) — `(3) Kirim WhatsApp`.
   - Kolom kiri:
     - Daftar item keranjang interaktif lengkap dengan stepper kuantitas `[-] Qty [+]` dan tombol hapus.
     - Tombol dashed `+ Tambah layanan lain`.
     - Form **Detail project**: Nama lengkap, Nomor WhatsApp, Nama brand / usaha, Deadline diinginkan, Link referensi / Google Drive, dan Catatan brief.
     - Checkbox persetujuan revisi & jadwal.
   - Kolom kanan:
     - Ringkasan pesanan dengan input promo code (coba masukkan `DISKON10` atau `KREATIF`), subtotal, diskon, dan total biaya.
     - Tombol hijau `Kirim Pesanan via WhatsApp`.
     - **PRATINJAU PESAN WHATSAPP**: Bubble chat WhatsApp warna hijau yang memperbarui teks pesan secara **LIVE** sesuai input form dan keranjang pengguna.

4. **Halaman Konfirmasi Pesanan WhatsApp (`konfirmasi.html`)**
   - *Referensi Desain*: `landing-page/Konfirmasi-pesanan/06 Konfirmasi Kirim WhatsApp (Desktop).png`
   - Navbar atas dengan tautan `← Ubah pesanan`.
   - Stepper navigasi: `(✓) Keranjang` — `(✓) Detail project` — `(3) Kirim WhatsApp` (aktif).
   - Kartu sukses di tengah layar dengan ikon centang hijau besar.
   - Kotak ringkasan pesanan beige dengan rincian layanan dan total pembayaran.
   - Tombol utama `Buka WhatsApp & Kirim Pesanan` (otomatis membuka WhatsApp Web / aplikasi WhatsApp dengan pesan terformat rapi).
   - Tombol sekunder `Ubah Pesanan` dan link `Kembali ke Beranda`.

5. **Panel Admin / Dashboard (`dashboard.html`)**
   - Dibuat untuk memenuhi kebutuhan pengelolaan pesanan mahasiswa/dosen/klien.
   - Statistik kartu ringkasan: Total Pesanan, Menunggu WhatsApp, Sedang Dikerjakan, dan Estimasi Omzet.
   - Tabel Pesanan & Brief Proyek: Filter pencarian, status pesanan, modal detail brief lengkap, dan tombol hubungi klien via WhatsApp langsung.
   - Tabel pengaturan layanan dan tarif dasar.

---

## 🚀 Cara Menjalankan Secara Lokal

Proyek ini dibuat menggunakan standar Web murni (HTML5, CSS3 modern, Vanilla JavaScript ES6+) dan dilengkapi server Node.js bawaan tanpa memerlukan `npm install`.

### Opsi 1: Menjalankan dengan Server Node.js (Direkomendasikan)
Buka terminal PowerShell atau Command Prompt pada direktori `landing-page`:

```powershell
cd "d:\Kuliah Guweh\PENGEMBANGAN PERANGKAT LUNAK\Anindita Project\proyek-ppl-kelompok4\landing-page"
node server.js
```

Lalu buka peramban web pada alamat:
- **Landing Page / Profil**: [http://127.0.0.1:4173/](http://127.0.0.1:4173/)
- **Checkout**: [http://127.0.0.1:4173/checkout](http://127.0.0.1:4173/checkout)
- **Konfirmasi**: [http://127.0.0.1:4173/konfirmasi](http://127.0.0.1:4173/konfirmasi)
- **Admin Dashboard**: [http://127.0.0.1:4173/dashboard](http://127.0.0.1:4173/dashboard)

### Opsi 2: Membuka File HTML Langsung (Offline / Static)
Anda dapat langsung klik ganda file `index.html` pada File Explorer. Semua fungsionalitas keranjang, kalkulasi harga, form brief, dan pratinjau pesan WhatsApp tetap bekerja 100% menggunakan `localStorage`.

---

## 🔌 Kesiapan Integrasi Backend (Backend-Ready Architecture)

Arsitektur aplikasi dipisahkan secara rapi melalui modul `js/api.js`:

### 1. Endpoint REST API yang Tersedia pada `server.js`
- `GET /api/content` : Mengambil data teks, testimoni, dan konfigurasi brand.
- `GET /api/services` : Mengambil daftar seluruh layanan dan paket harga.
- `GET /api/orders` : Mengambil seluruh daftar pesanan masuk dari klien.
- `POST /api/orders` : Menerima pesanan baru saat checkout disubmit.
- `PATCH /api/orders/:id` : Mengubah status pengerjaan pesanan (`pending_wa`, `processing`, `done`).

### 2. Format Payload Pesanan (Order Schema)
```json
{
  "id": "ORD-2026-001",
  "createdAt": "2026-11-24T10:15:00.000Z",
  "customerName": "Budi Santoso",
  "customerPhone": "081234567890",
  "brandName": "Kopi Senja",
  "deadline": "2026-11-30",
  "referenceLink": "https://drive.google.com/drive/folders/sample-kopi-senja",
  "briefNotes": "Butuh video reels 30 detik untuk promo menu kopi aren baru.",
  "status": "pending_wa",
  "statusLabel": "Menunggu WhatsApp",
  "items": [
    { "title": "Edit Video", "package": "Paket Reels", "quantity": 2, "price": 300000 },
    { "title": "Edit Feed Instagram", "package": "Carousel 9 slide", "quantity": 1, "price": 250000 },
    { "title": "3D Text Movement", "package": "Intro 10 detik", "quantity": 1, "price": 350000 }
  ],
  "subtotal": 1200000,
  "discount": 0,
  "total": 1200000
}
```

---

## 📱 Responsivitas Lintas Perangkat (Responsive Design)

Frontend telah diuji dan dioptimalkan untuk berbagai ukuran layar tanpa merubah estetika desain:
- **Desktop Ultrawide & 1440px**: Tampilan 100% identik dengan tangkapan layar desain Figma.
- **Laptop (1024px - 1280px)**: Grid proporsional, perataan padding seimbang.
- **Tablet (768px - 1023px)**: Grid 2 kolom yang rapi pada portofolio dan layanan.
- **Ponsel / Smartphone (360px - 767px)**:
  - Menu navigasi mobile drawer yang responsif.
  - Cart drawer memenuhi lebar layar secara elegan dengan target sentuh jempol yang nyaman.
  - Form checkout dan ringkasan tersusun vertikal secara alami.

