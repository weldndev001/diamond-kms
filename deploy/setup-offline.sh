#!/bin/bash
# =============================================================================
# Diamond KMS - Script Setup Offline (On-Premise / LAN)
# =============================================================================
# Script ini membantu setup awal Diamond KMS di server lokal.
#
# Cara Pakai:
#   chmod +x deploy/setup-offline.sh
#   ./deploy/setup-offline.sh
# =============================================================================

set -e

echo "=============================================="
echo "  Diamond KMS - Offline Setup"
echo "=============================================="
echo ""

# --- 1. Cek Docker ---
if ! command -v docker &> /dev/null; then
    echo "❌ Docker belum terinstall!"
    echo "   Download di: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose belum terinstall!"
    exit 1
fi

echo "✅ Docker terdeteksi: $(docker --version)"
echo ""

# --- 2. Siapkan .env ---
if [ ! -f .env ]; then
    echo "📋 Membuat file .env dari template offline..."
    cp .env.offline.example .env
    echo "✅ File .env berhasil dibuat."
    echo "⚠️  PENTING: Edit file .env dan sesuaikan konfigurasi sebelum lanjut!"
    echo ""
else
    echo "✅ File .env sudah ada."
    echo ""
fi

# --- 3. Build & Start Containers ---
echo "🚀 Memulai build dan start semua service..."
echo "   (Ini bisa memakan waktu 5-10 menit pada pertama kali)"
echo ""

docker compose -f docker-compose.offline.yml up -d --build

echo ""
echo "✅ Semua container berhasil dijalankan!"
echo ""

# --- 4. Tunggu Database Siap ---
echo "⏳ Menunggu database siap..."
sleep 10

# --- 5. Setup Database Schema ---
echo "📦 Membuat tabel database (Prisma DB Push)..."
docker compose -f docker-compose.offline.yml exec -T app npx prisma db push --skip-generate
echo "✅ Schema database berhasil dibuat!"
echo ""

# --- 6. Seed Data Awal ---
echo "🌱 Mengisi data awal (Seed)..."
docker compose -f docker-compose.offline.yml exec -T app npx prisma db seed
echo "✅ Data awal berhasil diisi!"
echo ""

# --- 7. Download Model AI ---
echo "🤖 Mendownload model AI ke Ollama..."
echo "   (Ini bisa memakan waktu tergantung kecepatan internet)"
echo ""

# Model Chat
echo "   📥 Downloading model chat (gemma3:4b)..."
docker compose -f docker-compose.offline.yml exec -T ollama ollama pull gemma3:4b

# Model Embedding
echo "   📥 Downloading model embedding (nomic-embed-text)..."
docker compose -f docker-compose.offline.yml exec -T ollama ollama pull nomic-embed-text

echo ""
echo "✅ Model AI berhasil di-download!"
echo ""

# --- 8. Tampilkan Info ---
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "Tidak terdeteksi")

echo "=============================================="
echo "  ✅ SETUP SELESAI!"
echo "=============================================="
echo ""
echo "  Akses Diamond KMS di:"
echo "  • Lokal:    http://localhost:7000"
echo "  • LAN:      http://${LOCAL_IP}:7000"
echo ""
echo "  Service yang berjalan:"
echo "  • App:      http://localhost:7000"
echo "  • Database: localhost:5432"
echo "  • Ollama:   http://localhost:11434"
echo ""
echo "  Perintah berguna:"
echo "  • Lihat log:     docker compose -f docker-compose.offline.yml logs -f"
echo "  • Stop semua:    docker compose -f docker-compose.offline.yml down"
echo "  • Restart:       docker compose -f docker-compose.offline.yml restart"
echo ""
echo "  ⚠️  CATATAN:"
echo "  Setelah model AI selesai di-download, Anda bisa"
echo "  MENCABUT koneksi internet. Sistem akan berjalan"
echo "  100% secara offline di jaringan lokal (LAN)."
echo "=============================================="
