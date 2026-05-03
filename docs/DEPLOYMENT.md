# 📦 Panduan Deployment Diamond KMS

Dokumen ini menjelaskan cara menjalankan Diamond KMS dalam **dua mode**: Online (Cloud) dan Offline (On-Premise / LAN).

Kedua mode menggunakan **1 codebase yang sama**. Perbedaannya hanya pada konfigurasi `.env` dan infrastruktur yang digunakan.

---

## Daftar Isi

- [Perbandingan Mode](#perbandingan-mode)
- [Mode 1: Online (Cloud)](#-mode-1-online-cloud)
  - [Opsi A: Vercel + Database Cloud](#opsi-a-vercel--database-cloud)
  - [Opsi B: VPS / Coolify / Docker](#opsi-b-vps--coolify--docker)
- [Mode 2: Offline (On-Premise / LAN)](#-mode-2-offline-on-premise--lan)
  - [Prasyarat Hardware](#prasyarat-hardware)
  - [Langkah Setup](#langkah-setup)
  - [Akses dari Perangkat Lain](#akses-dari-perangkat-lain-di-jaringan)
  - [Manajemen Model AI](#manajemen-model-ai)
- [Referensi Environment Variables](#-referensi-environment-variables)
- [Perintah Operasional](#-perintah-operasional)
- [Troubleshooting](#-troubleshooting)

---

## Perbandingan Mode

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   ☁️  MODE ONLINE (CLOUD)              🏢  MODE OFFLINE (LAN)           │
│                                                                          │
│   ┌──────────┐                         ┌─────────────────────────────┐  │
│   │  Vercel   │   ← Frontend           │     SERVER LOKAL (1 PC)     │  │
│   └────┬─────┘                         │                             │  │
│        │ internet                      │  App + Database + AI        │  │
│   ┌────▼─────┐                         │  (semua dalam Docker)       │  │
│   │  VPS /   │   ← Backend+DB+AI      │                             │  │
│   │  Cloud   │                         └──────────┬──────────────────┘  │
│   └──────────┘                                    │                     │
│        │                                     WiFi / LAN                 │
│     Internet                                      │                     │
│        │                               ┌──────────┼──────────┐         │
│   ┌────▼──────────┐                    │    📱    💻    📱    │         │
│   │ 📱 💻 🖥️      │                    │  Karyawan via WiFi   │         │
│   │ Akses global  │                    └─────────────────────┘         │
│   └───────────────┘                                                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

| Aspek | ☁️ Online | 🏢 Offline |
|---|---|---|
| **Hosting** | Vercel / VPS / Cloud | Server lokal di kantor |
| **Database** | PostgreSQL Cloud | PostgreSQL lokal (Docker) |
| **AI Engine** | Gemini API / Olla Server | Ollama lokal (Docker) |
| **File Storage** | Cloud Storage / Server | Hard disk server lokal |
| **Akses User** | Via internet dari mana saja | Via WiFi/LAN kantor |
| **Internet** | Dibutuhkan selalu | Hanya saat setup awal |
| **Cocok Untuk** | SaaS, multi-tenant | Enterprise, keamanan data tinggi |

---

## ☁️ Mode 1: Online (Cloud)

### Opsi A: Vercel + Database Cloud

Cocok untuk: Deployment cepat, skala kecil-menengah.

#### Prasyarat
- Akun [Vercel](https://vercel.com)
- Database PostgreSQL Cloud ([Supabase](https://supabase.com), [Neon](https://neon.tech), atau self-hosted)
- API Key AI (Gemini / OpenAI) atau Server AI sendiri

#### Langkah

**1. Push ke GitHub**
```bash
git remote add origin <repository-url>
git push -u origin main
```

**2. Import ke Vercel**
- Buka [vercel.com/new](https://vercel.com/new)
- Import repository dari GitHub
- Set **Framework Preset**: Next.js
- Set **Build Command**: `npm run build`
- Set **Output Directory**: `.next`

**3. Konfigurasi Environment Variables di Vercel**

Buka Settings > Environment Variables, lalu tambahkan:

```env
# Database Cloud
DATABASE_URL="postgresql://user:pass@host:5432/diamondkms"
DIRECT_URL="postgresql://user:pass@host:5432/diamondkms"

# File Storage
UPLOAD_DIR="./uploads"

# AI Provider (pilih salah satu)
# --- Opsi 1: Google Gemini ---
AI_PROVIDER="managed"
GEMINI_API_KEY="AIzaSy..."

# --- Opsi 2: Self-hosted (Olla/Ollama) ---
# AI_PROVIDER="self_hosted"
# AI_ENDPOINT="https://ai-server-anda.com/v1"
# AI_API_KEY="api-key-anda"
# AI_CHAT_MODEL="gemma-4-E2B-it-Q4_K_M-unsloth.gguf"
# AI_EMBED_MODEL="nomic-embed-text"

# Security
NEXTAUTH_URL="https://domain-anda.vercel.app"
NEXTAUTH_SECRET="string-random-panjang-minimal-32-karakter"
NEXT_PUBLIC_APP_URL="https://domain-anda.vercel.app"
CRON_SECRET="string-random"
ENCRYPTION_KEY="string-32-karakter-tepat"

# Monitoring
INSTANCE_KEY="DKMS-PROD-001"
INSTANCE_NAME="Diamond KMS Production"
MONITORING_CENTER_URL=""

# License
ACTIVATION_MODE="online"
LICENSE_SECRET="diamond-kms-shared-secret-2026"
LICENSE_KEY=""
```

**4. Deploy**
```bash
# Vercel akan auto-deploy setiap push ke main
git push origin main
```

**5. Setup Database**
```bash
# Dari lokal, dengan DATABASE_URL mengarah ke cloud
npx prisma db push
npx prisma db seed  # (opsional)
```

---

### Opsi B: VPS / Coolify / Docker

Cocok untuk: Kontrol penuh, server sendiri (tetap perlu internet).

#### Langkah

**1. SSH ke server**
```bash
ssh user@server-ip
```

**2. Clone repository**
```bash
git clone <repository-url> diamond-kms
cd diamond-kms
```

**3. Siapkan `.env`**
```bash
cp .env.offline.example .env
nano .env
```

Edit konfigurasi sesuai kebutuhan:
- Arahkan `DATABASE_URL` ke PostgreSQL cloud Anda, **ATAU** gunakan database dari Docker Compose
- Set `AI_PROVIDER` dan API keys sesuai provider AI yang digunakan
- Set `NEXTAUTH_URL` ke domain VPS (misal: `https://kms.domain.com`)

**4. Build & Run**
```bash
docker compose -f docker-compose.offline.yml up -d --build
```

**5. Setup Database**
```bash
docker compose -f docker-compose.offline.yml exec app npx prisma db push
docker compose -f docker-compose.offline.yml exec app npx prisma db seed
```

**6. (Opsional) Setup Reverse Proxy**

Jika menggunakan domain, setup Nginx/Caddy sebagai reverse proxy:
```nginx
server {
    listen 80;
    server_name kms.domain.com;

    location / {
        proxy_pass http://localhost:7000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🏢 Mode 2: Offline (On-Premise / LAN)

Mode ini menjalankan **seluruh sistem** (App + Database + AI) di dalam satu komputer/server tanpa koneksi internet.

### Prasyarat Hardware

| Komponen | Minimum | Rekomendasi |
|---|---|---|
| **CPU** | 4 Core | 8+ Core |
| **RAM** | 8 GB | 16+ GB |
| **Disk** | 50 GB SSD | 100+ GB SSD |
| **OS** | Windows 10/11, Ubuntu 22+ | Ubuntu 22.04 LTS Server |
| **GPU** | Tidak wajib | NVIDIA 6GB+ VRAM (AI lebih cepat) |

> ⚠️ **RAM 8 GB adalah minimum absolut.** Model AI (Ollama) membutuhkan ~3-4 GB RAM. Jika RAM kurang, AI akan sangat lambat.

### Langkah Setup

#### Langkah 1: Install Docker

**Windows:**
1. Download [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Install dan restart komputer
3. Pastikan Docker Desktop berjalan (ikon 🐳 di system tray)

**Ubuntu/Linux:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout dan login kembali
```

#### Langkah 2: Download Source Code

```bash
git clone <repository-url> diamond-kms
cd diamond-kms
```

Atau copy folder project ke server menggunakan USB/SCP.

#### Langkah 3: Jalankan Setup Otomatis

**Windows:**
```
deploy\setup-offline.bat
```

**Linux/macOS:**
```bash
chmod +x deploy/setup-offline.sh
./deploy/setup-offline.sh
```

Script ini akan otomatis:
1. ✅ Membuat file `.env` dari template `.env.offline.example`
2. ✅ Build dan start semua container Docker
3. ✅ Membuat tabel database (Prisma)
4. ✅ Mengisi data awal (Seed)
5. ✅ Download model AI ke Ollama (~2-3 GB, butuh internet 1x)

#### Langkah 4: Verifikasi

Buka browser di server:
```
http://localhost:7000
```

Jika halaman login muncul, setup berhasil! ✅

#### Langkah 5: Lepas Internet 🔌

Setelah semua model AI selesai di-download, Anda bisa **mencabut koneksi internet**. Semua service berjalan secara lokal:
- **Database**: PostgreSQL di Docker (port 5432)
- **AI Engine**: Ollama di Docker (port 11434)
- **File**: Hard disk server (`/app/uploads`)

### Akses dari Perangkat Lain di Jaringan

1. **Cari IP Address server:**
   ```bash
   # Windows
   ipconfig
   
   # Linux
   hostname -I
   ```
   Contoh hasilnya: `192.168.1.100`

2. **Pastikan semua perangkat terhubung ke WiFi/LAN yang sama**

3. **Buka browser di HP/laptop karyawan:**
   ```
   http://192.168.1.100:7000
   ```

4. **(Opsional) Setup DNS lokal** agar lebih mudah diingat:
   - Edit file `hosts` di komputer karyawan:
     - Windows: `C:\Windows\System32\drivers\etc\hosts`
     - macOS/Linux: `/etc/hosts`
   - Tambahkan baris:
     ```
     192.168.1.100   kms.lokal
     ```
   - Sekarang karyawan bisa akses: `http://kms.lokal:7000`

### Manajemen Model AI

#### Melihat Model yang Terinstall
```bash
docker compose -f docker-compose.offline.yml exec ollama ollama list
```

#### Mengganti/Menambah Model

Jika server memiliki spesifikasi tinggi, gunakan model yang lebih pintar:

```bash
# Model Chat yang lebih pintar (perlu internet untuk download)
docker compose -f docker-compose.offline.yml exec ollama ollama pull gemma3:12b

# Lalu update .env
AI_CHAT_MODEL=gemma3:12b

# Restart app
docker compose -f docker-compose.offline.yml restart app
```

#### Daftar Model Rekomendasi

| Model | Ukuran | RAM Minimal | Kualitas |
|---|---|---|---|
| `gemma3:1b` | ~0.8 GB | 4 GB | ⭐⭐ Dasar |
| `gemma3:4b` | ~2.5 GB | 8 GB | ⭐⭐⭐ Bagus (Default) |
| `gemma3:12b` | ~7.5 GB | 16 GB | ⭐⭐⭐⭐ Sangat bagus |
| `gemma3:27b` | ~16 GB | 32 GB | ⭐⭐⭐⭐⭐ Terbaik |

---

## 🔧 Referensi Environment Variables

### Variabel Wajib (Semua Mode)

| Variable | Deskripsi | Contoh |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `DIRECT_URL` | Direct connection (untuk Prisma) | Sama dengan DATABASE_URL |
| `NEXTAUTH_URL` | URL aplikasi untuk auth | `http://localhost:7000` |
| `NEXTAUTH_SECRET` | Secret key untuk session | String random 32+ karakter |
| `NEXT_PUBLIC_APP_URL` | URL publik aplikasi | `http://localhost:7000` |
| `ENCRYPTION_KEY` | Key enkripsi (tepat 32 char) | `diamond-kms-encryption-key-32chr` |

### Variabel AI

| Variable | Deskripsi | Default |
|---|---|---|
| `AI_PROVIDER` | Provider AI: `managed`, `byok`, `self_hosted` | `managed` |
| `GEMINI_API_KEY` | API Key Google Gemini (jika managed) | - |
| `AI_ENDPOINT` | URL endpoint AI (jika self_hosted) | `http://localhost:11434/v1` |
| `AI_API_KEY` | API Key untuk endpoint AI | - |
| `AI_CHAT_MODEL` | Nama model untuk chat | `gemma3:4b` |
| `AI_EMBED_MODEL` | Nama model untuk embedding | `nomic-embed-text` |
| `AI_TEMPERATURE` | Kreativitas AI (0.0 - 1.0) | `0.7` |
| `AI_MAX_TOKENS` | Maks token per respons | `2048` |
| `AI_EMBEDDING_DIMENSIONS` | Dimensi vektor embedding | `768` |

### Variabel Sistem

| Variable | Deskripsi | Default |
|---|---|---|
| `UPLOAD_DIR` | Direktori simpan file | `./uploads` |
| `CRON_SECRET` | Secret untuk cron jobs | - |
| `INSTANCE_KEY` | ID unik instance | `DKMS-DEFAULT` |
| `INSTANCE_NAME` | Nama tampilan instance | `Diamond KMS` |
| `MONITORING_CENTER_URL` | URL monitoring center | `` (kosong = disabled) |
| `ACTIVATION_MODE` | Mode lisensi: `online` / `offline` | `offline` |
| `LICENSE_KEY` | Kunci lisensi | - |

---

## 🔄 Perintah Operasional

### Development (Tanpa Docker)
```bash
npm run dev                    # Start dev server (port 7000)
npm run build                  # Build production
npm run start                  # Start production server
npx prisma db push             # Sync schema ke database
npx prisma db seed             # Isi data contoh
npx prisma studio              # Buka GUI database
```

### Docker (Online & Offline)
```bash
# Start semua service
docker compose -f docker-compose.offline.yml up -d

# Start dengan rebuild
docker compose -f docker-compose.offline.yml up -d --build

# Lihat status container
docker compose -f docker-compose.offline.yml ps

# Lihat log (real-time)
docker compose -f docker-compose.offline.yml logs -f
docker compose -f docker-compose.offline.yml logs -f app      # Hanya app
docker compose -f docker-compose.offline.yml logs -f db       # Hanya database
docker compose -f docker-compose.offline.yml logs -f ollama   # Hanya AI

# Restart semua service
docker compose -f docker-compose.offline.yml restart

# Stop semua (data tetap tersimpan)
docker compose -f docker-compose.offline.yml down

# Stop dan HAPUS semua data (⚠️ BERBAHAYA)
docker compose -f docker-compose.offline.yml down -v
```

### Backup & Restore Database
```bash
# Backup
docker compose -f docker-compose.offline.yml exec db \
  pg_dump -U diamondkms diamondkms > backup_$(date +%Y%m%d).sql

# Restore
docker compose -f docker-compose.offline.yml exec -T db \
  psql -U diamondkms diamondkms < backup_20260503.sql
```

---

## 🔍 Troubleshooting

### ❌ App tidak bisa diakses dari HP/PC lain
1. Pastikan server dan perangkat terhubung ke **jaringan WiFi/LAN yang sama**
2. Cek **firewall** di server:
   - **Windows**: Settings > Windows Security > Firewall > Allow an app > Tambah port 7000
   - **Linux**: `sudo ufw allow 7000`
3. Coba ping dari perangkat lain: `ping 192.168.1.100`

### ❌ AI tidak merespons / sangat lambat
```bash
# Cek Ollama berjalan
docker compose -f docker-compose.offline.yml logs ollama

# Cek model sudah ter-download
docker compose -f docker-compose.offline.yml exec ollama ollama list

# Test AI langsung
docker compose -f docker-compose.offline.yml exec ollama \
  ollama run gemma3:4b "Halo, apa kabar?"
```

Jika lambat, pertimbangkan:
- Tambah RAM server
- Gunakan model yang lebih kecil (`gemma3:1b`)
- Tambah GPU NVIDIA (uncomment bagian `deploy.resources` di `docker-compose.offline.yml`)

### ❌ Database error / connection refused
```bash
# Cek status database
docker compose -f docker-compose.offline.yml logs db

# Cek container berjalan
docker compose -f docker-compose.offline.yml ps

# Restart database
docker compose -f docker-compose.offline.yml restart db

# Jika perlu reset total (⚠️ DATA HILANG):
docker compose -f docker-compose.offline.yml down -v
docker compose -f docker-compose.offline.yml up -d
# Lalu setup ulang:
docker compose -f docker-compose.offline.yml exec app npx prisma db push
docker compose -f docker-compose.offline.yml exec app npx prisma db seed
```

### ❌ Build Docker gagal (out of memory)
- Pastikan Docker Desktop memiliki alokasi RAM minimal 4 GB
- Windows: Docker Desktop > Settings > Resources > Memory

### ❌ Port sudah dipakai
Ubah port di file `.env`:
```env
APP_PORT=8000        # Ganti dari 7000 ke 8000
DB_PORT=5433         # Ganti dari 5432 ke 5433
OLLAMA_PORT=11435    # Ganti dari 11434 ke 11435
```
Lalu restart: `docker compose -f docker-compose.offline.yml up -d`

---

## 📋 Checklist Deployment

### ☁️ Online
- [ ] Database PostgreSQL Cloud sudah ready
- [ ] Ekstensi `uuid-ossp` dan `vector` sudah aktif di database
- [ ] Environment variables sudah diset di Vercel/VPS
- [ ] `NEXTAUTH_URL` mengarah ke domain yang benar
- [ ] `npx prisma db push` sudah dijalankan
- [ ] Bisa login dan mengakses dashboard

### 🏢 Offline
- [ ] Docker Desktop terinstall dan berjalan
- [ ] File `.env` sudah dibuat dari `.env.offline.example`
- [ ] `docker compose up -d` berhasil (3 container running)
- [ ] Database schema sudah dibuat (`prisma db push`)
- [ ] Model AI sudah ter-download (`ollama list`)
- [ ] Bisa akses dari `http://localhost:7000`
- [ ] Bisa akses dari perangkat lain via IP LAN
- [ ] Internet bisa dicabut dan sistem tetap berjalan
