# 📦 Panduan Deployment Offline (On-Premise / LAN)

Panduan ini menjelaskan cara menginstall dan menjalankan Diamond KMS di server lokal tanpa koneksi internet (setelah setup awal selesai).

## Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                   SERVER LOKAL (LAN)                    │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Diamond KMS │  │  PostgreSQL  │  │    Ollama     │  │
│  │  (Next.js)   │  │  + pgvector  │  │  (AI Lokal)   │  │
│  │  Port: 7000  │  │  Port: 5432  │  │  Port: 11434  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                 │                 │           │
│         └────────────┬────┴─────────────────┘           │
│                      │                                  │
│              Docker Network (internal)                  │
│                      │                                  │
│              ┌───────┴────────┐                         │
│              │  Port 7000     │ ← Satu-satunya port     │
│              │  (exposed)     │   yang perlu dibuka      │
│              └───────┬────────┘                         │
└──────────────────────┼──────────────────────────────────┘
                       │
            ┌──────────┼──────────┐
            │    WiFi / LAN       │
            │    Router           │
            └──┬───────┬──────┬───┘
               │       │      │
            📱 HP   💻 PC   📱 HP
          Karyawan  Karyawan  Karyawan
```

## Prasyarat

| Komponen | Minimum | Rekomendasi |
|---|---|---|
| **CPU** | 4 Core | 8+ Core |
| **RAM** | 8 GB | 16+ GB |
| **Disk** | 50 GB SSD | 100+ GB SSD |
| **OS** | Windows 10/11, Ubuntu 22+, macOS | Ubuntu 22.04 LTS (Server) |
| **Software** | Docker Desktop | Docker Desktop |
| **GPU** | - (opsional) | NVIDIA GPU 6GB+ VRAM (untuk AI lebih cepat) |

> **Catatan**: RAM 8 GB adalah minimum karena model AI (Ollama) membutuhkan ~3-4 GB RAM sendiri.

## Langkah 1: Install Docker

### Windows
1. Download [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Install dan restart komputer
3. Buka Docker Desktop, pastikan berjalan (ikon whale di system tray)

### Ubuntu/Linux
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout dan login kembali
```

## Langkah 2: Download Source Code

Copy folder project Diamond KMS ke server, atau clone dari repository:
```bash
git clone <repository-url> diamond-kms
cd diamond-kms
```

## Langkah 3: Jalankan Setup

### Windows
```
deploy\setup-offline.bat
```

### Linux/macOS
```bash
chmod +x deploy/setup-offline.sh
./deploy/setup-offline.sh
```

Script ini akan otomatis:
1. ✅ Membuat file `.env` dari template
2. ✅ Build dan start semua container (PostgreSQL, Ollama, App)
3. ✅ Membuat tabel database (Prisma)
4. ✅ Mengisi data awal (Seed)
5. ✅ Download model AI (membutuhkan internet sementara, ~2-3 GB)

## Langkah 4: Akses Aplikasi

Setelah setup selesai:
- **Dari server sendiri**: Buka browser → `http://localhost:7000`
- **Dari komputer/HP di jaringan**: Buka browser → `http://<IP-SERVER>:7000`

Untuk mengetahui IP server:
```bash
# Windows
ipconfig

# Linux
hostname -I
```

## Langkah 5: Lepas Koneksi Internet 🔌

Setelah semua model AI selesai di-download, Anda bisa **mencabut koneksi internet**. Sistem akan berjalan 100% secara offline menggunakan:
- **Database**: PostgreSQL lokal
- **AI**: Ollama lokal
- **File**: Hard disk lokal (`/app/uploads`)

---

## Model AI yang Digunakan

| Fungsi | Model Default | Ukuran | Keterangan |
|---|---|---|---|
| **Chat / Tanya Jawab** | `gemma3:4b` | ~2.5 GB | Model ringan, cukup untuk Q&A |
| **Embedding (Pencarian)** | `nomic-embed-text` | ~275 MB | Untuk pencarian semantik dokumen |

### Mengganti Model AI

Jika server memiliki GPU/RAM lebih besar, Anda bisa menggunakan model yang lebih pintar:

```bash
# Download model yang lebih besar (butuh internet)
docker compose -f docker-compose.offline.yml exec ollama ollama pull gemma3:12b

# Lalu ubah di file .env
AI_CHAT_MODEL=gemma3:12b
```

Lalu restart: `docker compose -f docker-compose.offline.yml restart app`

---

## Perintah Operasional

```bash
# Lihat status semua container
docker compose -f docker-compose.offline.yml ps

# Lihat log aplikasi (real-time)
docker compose -f docker-compose.offline.yml logs -f app

# Restart semua service
docker compose -f docker-compose.offline.yml restart

# Stop semua service
docker compose -f docker-compose.offline.yml down

# Start kembali (tanpa rebuild)
docker compose -f docker-compose.offline.yml up -d

# Backup database
docker compose -f docker-compose.offline.yml exec db pg_dump -U diamondkms diamondkms > backup_$(date +%Y%m%d).sql
```

## Troubleshooting

### App tidak bisa diakses dari HP/PC lain
- Pastikan server dan HP/PC terhubung ke **jaringan WiFi/LAN yang sama**
- Pastikan **firewall** di server mengizinkan port 7000
- Windows: `Settings > Windows Security > Firewall > Allow an app > Port 7000`

### AI tidak merespons
```bash
# Cek apakah Ollama berjalan
docker compose -f docker-compose.offline.yml logs ollama

# Cek model sudah ter-download
docker compose -f docker-compose.offline.yml exec ollama ollama list
```

### Database error
```bash
# Cek log database
docker compose -f docker-compose.offline.yml logs db

# Reset database (HATI-HATI: Data akan hilang!)
docker compose -f docker-compose.offline.yml down -v
docker compose -f docker-compose.offline.yml up -d
# Lalu jalankan setup ulang
```
