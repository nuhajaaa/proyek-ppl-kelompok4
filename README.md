# proyek-ppl-kelompok4
# Anindita Space — Website

Repositori ini berisi kode sumber, dokumentasi analisis sistem, dan perancangan arsitektur untuk pengembangan **Website Anindita Space**.

---

## 📌 Ringkasan Proyek

Website **Anindita Space** dibangun untuk [jelaskan tujuan utama bisnis/produk, misalnya: menampilkan profil ruang/layanan, mempermudah informasi katalog/paket, serta menangani reservasi/pertanyaan pelanggan secara digital].

Dokumen ini merangkum tahapan perencanaan, analisis kebutuhan, perancangan sistem, dan panduan pengembangan proyek.

---

## 🚀 Fitur Utama (Berdasarkan Prioritas MoSCoW)

### Must-Have (Wajib Ada untuk Rilis Awal)
* [ ] Halaman Beranda (*Landing Page*) & Profil Anindita Space
* [ ] Katalog Layanan / Ruang / Produk
* [ ] Formulir Kontak / Reservasi / Pemesanan Dasar
* [ ] Manajemen Konten / Data Dasar (*Admin/Owner*)

### Should-Have (Penting)
* [ ] Pencarian & Penyaringan (*Filter*) Item/Layanan
* [ ] Notifikasi / Konfirmasi Status Pengajuan
* [ ] Dashboard Ringkasan untuk Pengelola

### Could-Have (Tambahan / Nilai Lebih)
* [ ] Galeri Interaktif / Testimoni Pengunjung
* [ ] Integrasi Kalender / Jadwal Ketersediaan Real-Time

### Won't-Have (Belum Dikerjakan di Fase Ini)
* [ ] [Sebutkan fitur yang ditunda ke fase berikutnya, jika ada]

---

## 🧠 Analisis Kebutuhan & Dokumentasi Sistem

Proyek ini dikembangkan melalui tahapan analisis dan perancangan terstruktur:

1. **Proposal Proyek:** Penyusunan ruang lingkup, tujuan, estimasi lini masa/biaya, dan pengesahan (*sign-off*) bersama *owner*.
2. **Elisitasi Kebutuhan:** Wawancara mendalam dengan *owner* serta penyusunan notulen dan daftar kebutuhan fungsional & non-fungsional.
3. **Product Backlog & MoSCoW:** Penerjemahan kebutuhan menjadi *User Story*, *Acceptance Criteria*, dan penentuan prioritas **MoSCoW**.
4. **SRS & Spesifikasi Use Case:** Dokumentasi *Software Requirements Specification* (SRS) beserta diagram dan skenario *Use Case* (*main flow*, *alternative flow*, *exception flow*).
5. **Perancangan Arsitektur & Diagram:** Penerapan pola arsitektur **MVC** (*Model-View-Controller*), *Use Case Diagram*, dan *Sequence Diagram*.

> **Tautan Dokumen Pendukung:**
> * Proposal Proyek: `[Link Dokumen]`
> * Notulen & Hasil Elisitasi: `[Link Dokumen]`
> * Product Backlog (MoSCoW): `[Link Spreadsheet / Board]`
> * Dokumen SRS: `[Link Dokumen]`
> * Diagram (Use Case, Sequence, MVC): `[Link Draw.io / Lucidchart / Figma]`

---

## 🏗️ Arsitektur Sistem (MVC)

Aplikasi dirancang menggunakan pendekatan **Model-View-Controller (MVC)** agar kode terorganisasi dan mudah dipelihara:

* **Model:** Mengelola struktur data, query/interaksi *database*, dan aturan data inti.
* **View:** Menampilkan antarmuka pengguna (*UI*) dan merespons data yang dikirimkan oleh *Controller*.
* **Controller:** Menangani permintaan pengguna (*request*), menjalankan logika bisnis, menghubungkan *Model* dan *View*, serta mengembalikan respons.

---

## 🛠️ Tech Stack

Sesuaikan bagian ini dengan teknologi yang Anda gunakan:

* **Frontend:** HTML5, CSS3 / Tailwind CSS / Bootstrap, JavaScript
* **Backend:** [Contoh: PHP / Laravel / Node.js / Python]
* **Database:** [Contoh: MySQL / PostgreSQL]
* **Version Control & Project Management:** Git & GitHub (Issues & Projects)

---

## ⚙️ Panduan Instalasi & Menjalankan Proyek (Lokal)

1. **Clone repositori**
   ```bash
   git clone [https://github.com/username/anindita-space.git](https://github.com/username/anindita-space.git)
   cd anindita-space
