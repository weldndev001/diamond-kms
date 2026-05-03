@echo off
REM =============================================================================
REM Diamond KMS - Script Setup Offline (On-Premise / LAN) - Windows
REM =============================================================================
REM Script ini membantu setup awal Diamond KMS di server lokal.
REM
REM Cara Pakai:
REM   Klik kanan > Run as Administrator
REM   Atau jalankan dari CMD: deploy\setup-offline.bat
REM =============================================================================

echo ==============================================
echo   Diamond KMS - Offline Setup (Windows)
echo ==============================================
echo.

REM --- 1. Cek Docker ---
docker --version >nul 2>&1
if errorlevel 1 (
    echo [X] Docker belum terinstall!
    echo     Download di: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo [OK] Docker terdeteksi.
echo.

REM --- 2. Siapkan .env ---
if not exist ".env" (
    echo [INFO] Membuat file .env dari template offline...
    copy .env.offline.example .env >nul
    echo [OK] File .env berhasil dibuat.
    echo [!!] PENTING: Edit file .env dan sesuaikan konfigurasi sebelum lanjut!
    echo.
) else (
    echo [OK] File .env sudah ada.
    echo.
)

REM --- 3. Build & Start Containers ---
echo [PROSES] Memulai build dan start semua service...
echo          (Ini bisa memakan waktu 5-10 menit pada pertama kali)
echo.

docker compose -f docker-compose.offline.yml up -d --build

if errorlevel 1 (
    echo [X] Gagal menjalankan Docker Compose!
    pause
    exit /b 1
)

echo.
echo [OK] Semua container berhasil dijalankan!
echo.

REM --- 4. Tunggu Database Siap ---
echo [PROSES] Menunggu database siap...
timeout /t 15 /nobreak >nul

REM --- 5. Setup Database Schema ---
echo [PROSES] Membuat tabel database (Prisma DB Push)...
docker compose -f docker-compose.offline.yml exec -T app npx prisma db push --skip-generate

if errorlevel 1 (
    echo [X] Gagal membuat schema database!
    pause
    exit /b 1
)

echo [OK] Schema database berhasil dibuat!
echo.

REM --- 6. Seed Data Awal ---
echo [PROSES] Mengisi data awal (Seed)...
docker compose -f docker-compose.offline.yml exec -T app npx prisma db seed

echo [OK] Data awal berhasil diisi!
echo.

REM --- 7. Download Model AI ---
echo [PROSES] Mendownload model AI ke Ollama...
echo          (Ukuran sekitar 2-3 GB, tergantung model)
echo.

echo    [DOWNLOAD] Model chat (gemma3:4b)...
docker compose -f docker-compose.offline.yml exec -T ollama ollama pull gemma3:4b

echo    [DOWNLOAD] Model embedding (nomic-embed-text)...
docker compose -f docker-compose.offline.yml exec -T ollama ollama pull nomic-embed-text

echo.
echo [OK] Model AI berhasil di-download!
echo.

REM --- 8. Tampilkan Info ---
echo ==============================================
echo   [OK] SETUP SELESAI!
echo ==============================================
echo.
echo   Akses Diamond KMS di:
echo     Lokal:    http://localhost:7000
echo     LAN:      http://[IP-KOMPUTER-INI]:7000
echo.
echo   Service yang berjalan:
echo     App:      http://localhost:7000
echo     Database: localhost:5432
echo     Ollama:   http://localhost:11434
echo.
echo   Perintah berguna:
echo     Lihat log:     docker compose -f docker-compose.offline.yml logs -f
echo     Stop semua:    docker compose -f docker-compose.offline.yml down
echo     Restart:       docker compose -f docker-compose.offline.yml restart
echo.
echo   CATATAN:
echo   Setelah model AI selesai di-download, Anda bisa
echo   MENCABUT koneksi internet. Sistem akan berjalan
echo   100% secara offline di jaringan lokal (LAN).
echo ==============================================
echo.
echo   Untuk mengetahui IP komputer ini, buka CMD baru
echo   dan ketik: ipconfig
echo.
pause
