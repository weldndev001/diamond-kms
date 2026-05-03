# 💎 DIAMOND Knowledge Management System (KMS)

**DIAMOND KMS** adalah sistem Knowledge Management modern berbasis AI yang mendukung pembelajaran, berbagi pengetahuan, dan manajemen informasi perusahaan.

Diamond KMS mendukung **dua mode deployment**:
- ☁️ **Online (Cloud)** — Deploy ke Vercel/VPS, akses dari mana saja via internet
- 🏢 **Offline (On-Premise/LAN)** — Deploy ke server lokal kantor, akses via WiFi tanpa internet

> 📖 Panduan lengkap deployment tersedia di [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## 🚀 Fitur Utama

- **Knowledge Base & Content Management** — Buat, kelola, dan organisir dokumen serta konten dengan rich-text editor (Tiptap)
- **AI Assistant** — Tanya jawab tentang pengetahuan perusahaan, ringkasan dokumen, dan pencarian semantik
- **Employee Engagement** — Kuis, Read Tracker, Leaderboard untuk gamifikasi pembelajaran
- **Enterprise Workflows** — Multi-role access control, Approval pipeline, User & Group management
- **Suggestion Box** — Karyawan bisa berkontribusi ide dan saran

---

## 🛠 Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) |
| ORM | [Prisma](https://www.prisma.io/) |
| Auth | [NextAuth.js](https://next-auth.js.org/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| UI | [Radix UI](https://www.radix-ui.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| AI | Gemini API / Ollama (Self-hosted) |
| Form | React Hook Form + Zod |

---

## ⚡ Quick Start (Development)

```bash
# 1. Clone repository
git clone <repository-url>
cd diamond-kms

# 2. Install dependencies
npm install

# 3. Siapkan file .env (salin dari contoh dan sesuaikan)
cp .env.example .env

# 4. Setup database
npx prisma generate
npx prisma db push
npx prisma db seed    # (opsional: data contoh)

# 5. Jalankan
npm run dev
```

Buka [http://localhost:7000](http://localhost:7000)

---

## 📦 Mode Deployment

Diamond KMS mendukung 2 mode deployment dari **1 codebase yang sama**. Perbedaannya hanya pada konfigurasi file `.env`:

| | ☁️ Online (Cloud) | 🏢 Offline (LAN) |
|---|---|---|
| **Hosting** | Vercel / VPS / Cloud | Server lokal di kantor |
| **Database** | PostgreSQL Cloud (Supabase/Neon/RDS) | PostgreSQL lokal (Docker) |
| **AI** | Gemini API / Self-hosted server | Ollama lokal (Docker) |
| **File Storage** | Cloud atau Server Storage | Hard disk server lokal |
| **Akses** | Via internet dari mana saja | Via WiFi/LAN kantor saja |
| **Internet** | Dibutuhkan selalu | Hanya saat setup awal |

> 📖 **Panduan lengkap**: Lihat [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) untuk instruksi detail kedua mode.

---

## 📜 Scripts

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Development server (port 7000) |
| `npm run build` | Build production |
| `npm run start` | Jalankan production server |
| `npm run lint` | Cek linting |

---

## 🔒 Roles & Security

Authentication menggunakan **NextAuth.js** dengan Credentials Provider + bcrypt.

| Role | Akses |
|---|---|
| `MAINTAINER` | System overview, error logs, AI config |
| `SUPER_ADMIN` | Full access, HR, Billing, semua fitur |
| `GROUP_ADMIN` | Kelola user & approval dalam group |
| `SUPERVISOR` | Monitor progress tim |
| `STAFF` | Akses knowledge base, kuis, AI Assistant |

---

## 📁 Struktur Penting

```
diamond-kms/
├── app/                    # Next.js App Router (pages & API)
├── components/             # Komponen UI
├── hooks/                  # Custom React hooks
├── lib/                    # Business logic, AI service, Prisma
│   ├── actions/            # Server Actions
│   ├── ai/                 # AI Provider factory & services
│   └── env.ts              # Environment variables config
├── prisma/                 # Database schema & migrations
├── deploy/                 # File deployment offline
│   ├── PANDUAN_OFFLINE.md  # Panduan setup offline (detail)
│   ├── setup-offline.sh    # Script setup Linux/macOS
│   ├── setup-offline.bat   # Script setup Windows
│   └── init-db.sql         # Init ekstensi PostgreSQL
├── docker-compose.offline.yml  # Docker Compose untuk offline
├── Dockerfile              # Build image Next.js
├── .env.offline.example    # Template .env untuk offline
└── docs/DEPLOYMENT.md      # Panduan deployment lengkap
```

---

For internal development support, reach out to the engineering team.
