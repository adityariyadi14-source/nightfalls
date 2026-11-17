# Panduan Hosting Nightfall (Online Multiplayer)

Nightfall terdiri dari **satu server Node.js**. Server itu sekaligus menyajikan website dan menjalankan "wasit" game lewat WebSocket. Jadi kamu cukup menyewa/menyiapkan **satu layanan** saja.

Yang dibutuhkan:

- Node.js versi 20 atau lebih baru (disarankan 22)
- Akun GitHub (gratis), untuk menyimpan kode
- Akun di salah satu penyedia hosting di bawah

---

## 1. Coba dulu di komputermu sendiri

1. Install Node.js dari <https://nodejs.org> (pilih versi **LTS**).
2. Ekstrak `nightfall-source.zip`, lalu buka terminal di folder `nightfall`.
3. Jalankan:

```bash
npm install
```

```bash
npm run dev
```

4. Buka <http://localhost:5173> di browser.

**Main bareng satu WiFi:** cari IP komputermu (Windows: `ipconfig`, Mac: `ipconfig getifaddr en0`). Lalu teman-temanmu buka `http://IP-KAMU:5173` dari HP mereka. Satu orang membuat ruangan, yang lain bergabung pakai kode 5 huruf.

Versi produksi (seperti nanti di internet):

```bash
npm run build
```

```bash
npm start
```

Lalu buka <http://localhost:8787>.

---

## 2. Upload kode ke GitHub

Pilih salah satu cara.

**Cara termudah (tanpa terminal):**

1. Masuk ke <https://github.com>, klik **New repository**, beri nama `nightfall`, pilih **Private** atau **Public**, lalu **Create repository**.
2. **Ekstrak dulu** `nightfall-github.zip` di komputermu. Jangan upload file zip-nya, karena GitHub tidak membuka zip.
3. Di halaman repo, klik **Add file → Upload files**.
4. Buka folder hasil ekstrak, pilih **semua isinya** (`Ctrl+A` / `Cmd+A`: `docs`, `src`, `server`, `package.json`, dan seterusnya), lalu seret ke halaman GitHub. Jumlahnya 87 file, masih di bawah batas 100 file per upload.
5. Klik **Commit changes**. Di halaman repo sekarang harus terlihat folder `docs`, `src`, `server`, dan file `package.json`.

**Cara dengan Git:**

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Nightfall"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/USERNAME-KAMU/nightfall.git
```

```bash
git push -u origin main
```

---

## 2b. GitHub Pages: versi main satu HP (gratis, tanpa server)

GitHub Pages hanya menyajikan file statis, jadi **mode online tidak bisa jalan di sana**. Tapi Pages cocok untuk versi oper-HP (offline), yang sudah disiapkan di `docs/index.html`.

1. Di repo, buka **Settings → Pages**.
2. **Source:** Deploy from a branch. **Branch:** `main`, folder **`/docs`** (bukan `/ (root)`), lalu **Save**.
3. Tunggu 1–2 menit, lalu buka `https://USERNAME.github.io/NAMA-REPO/`.

Untuk main online bareng dari HP masing-masing, lanjut ke Render di bawah. Repo yang sama bisa dipakai untuk keduanya.

## 3. Pilihan A: Render (gratis, paling mudah) ⭐ disarankan

1. Daftar di <https://render.com> pakai akun GitHub.
2. Klik **New +** lalu **Blueprint**, pilih repo `nightfall`. Render otomatis membaca file `render.yaml` yang sudah ada di proyek.
   Kalau kamu memilih **New + → Web Service** secara manual, isi:
   - **Runtime:** Node
   - **Build Command:** `npm ci --include=dev && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Instance Type:** Free
3. Klik **Deploy**. Tunggu 2–4 menit sampai statusnya **Live**.
4. Website-mu sekarang ada di alamat seperti `https://nightfall-xxxx.onrender.com`. Bagikan link ini ke teman-temanmu.

**Yang perlu diketahui tentang paket gratis Render:**

- **Server tidur:** setelah 15 menit tidak ada yang main, server "tidur". Pemain pertama yang membuka link harus menunggu sekitar 30–60 detik sampai server bangun. Setelah itu lancar.
- **Data bisa hilang:** akun dan riwayat pertandingan disimpan di file. Di paket gratis, file ini bisa terhapus saat server di-restart atau di-deploy ulang. Kalau mau permanen, upgrade ke paket berbayar, lalu tambahkan **Disk** (mount path `/var/data`) dan environment variable `DATA_FILE=/var/data/store.json`.
- **Game yang sedang berjalan** ikut berhenti kalau server restart. Pemain bisa membuat ruangan baru.

---

## 4. Pilihan B: Railway (mudah, berbayar murah)

1. Daftar di <https://railway.app> pakai GitHub.
2. **New Project** lalu **Deploy from GitHub repo**, pilih `nightfall`.
3. Railway otomatis mendeteksi `Dockerfile`. Biarkan.
4. Buka tab **Settings** lalu **Networking**, klik **Generate Domain**.
5. Agar data tidak hilang: tab **Volumes**, buat volume dengan mount path `/data`. Dockerfile sudah memakai `DATA_FILE=/data/store.json`.

Railway memberi kredit percobaan, setelah itu sekitar US$5 per bulan untuk game sekecil ini.

---

## 5. Pilihan C: VPS sendiri (Docker)

Untuk VPS (misalnya DigitalOcean, Vultr, IDCloudHost, Biznet Gio) yang sudah terpasang Docker:

```bash
docker build -t nightfall .
```

```bash
docker run -d --name nightfall --restart unless-stopped -p 8787:8787 -v nightfall-data:/data nightfall
```

Game bisa diakses di `http://IP-VPS:8787`. Supaya memakai HTTPS dan domain sendiri, pasang Caddy di VPS lalu jalankan:

```bash
caddy reverse-proxy --from namadomainmu.com --to localhost:8787
```

Caddy otomatis mengurus sertifikat HTTPS. WebSocket ikut berjalan tanpa pengaturan tambahan.

---

## 6. Pakai domain sendiri (opsional)

Di Render: buka layanan `nightfall`, lalu **Settings → Custom Domains → Add**. Ikuti instruksi DNS (biasanya menambah record `CNAME` di tempat kamu membeli domain). HTTPS dibuat otomatis.

---

## 7. Cek setelah online

1. Buka `https://alamat-kamu/api/health`. Harus muncul `{"ok":true,...}`.
2. Buka halaman utama, klik **Main sekarang → Buat ruangan**.
3. Dari HP lain, buka link yang sama, **Gabung ruangan**, lalu masukkan kode 5 hurufnya. Atau pakai tombol **Salin tautan** di lobi dan kirim ke grup chat.
4. Butuh minimal 4 pemain untuk mulai. Mode sulit butuh minimal 10.

---

## 8. Update game

Setiap kali kode diubah lalu di-push ke GitHub (atau di-upload ulang lewat web), Render dan Railway otomatis membangun dan men-deploy versi baru.

---

## 9. Kalau ada masalah

| Gejala | Penyebab & solusi |
| --- | --- |
| "Belum terhubung ke server" terus | Server sedang bangun (paket gratis). Tunggu 1 menit lalu muat ulang halaman. |
| Build gagal di Render | Pastikan Build Command persis `npm ci --include=dev && npm run build` dan file `package-lock.json` ikut ter-upload. |
| Halaman putih / 404 | Pastikan langkah build selesai. Server hanya menyajikan website setelah folder `dist` dibuat oleh `npm run build`. |
| Akun/riwayat hilang | Tambahkan disk/volume permanen dan set `DATA_FILE` (lihat bagian 3 dan 4). |
| Teman tidak bisa join | Pastikan semua membuka alamat **yang sama persis** dan kodenya benar. Ruangan yang sudah mulai tidak bisa dimasuki pemain baru. |

---

## Ringkasan perintah

| Tujuan | Perintah |
| --- | --- |
| Install | `npm install` |
| Mode pengembangan (web + server) | `npm run dev` |
| Build produksi | `npm run build` |
| Jalankan produksi | `npm start` |
| Semua tes | `npm run test:all` |
| Versi satu file (main lokal tanpa server) | `npm run build:artifact` |
| Perbarui `docs/index.html` untuk GitHub Pages | `npm run build:pages` |

Environment variable yang bisa diatur:

- `PORT`: port server (default `8787`; Render/Railway mengisinya otomatis)
- `DATA_FILE`: lokasi file data akun & riwayat (default `server/data/store.json`)
