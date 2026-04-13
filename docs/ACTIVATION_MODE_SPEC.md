# Dokumentasi Penerapan Mode Aktivasi: ONLINE & OFFLINE

Dokumen ini menjelaskan spesifikasi teknis dan alur implementasi fitur toggle Mode Aktivasi di Diamond KMS.

## 1. Konsep Umum

Mode Aktivasi menentukan bagaimana aplikasi klien memvalidasi lisensi dan terhubung ke ekosistem Diamond KMS.

| Mode | Deskripsi | Kebutuhan Klien |
| :--- | :--- | :--- |
| **ONLINE** | Aplikasi terhubung langsung ke DiamondKMS Center untuk otentikasi. | Username & Password Klien |
| **OFFLINE** | Aplikasi berjalan terisolasi dan divalidasi menggunakan License Key statis. | Fingerprint Hardware & License Key |

---

## 2. Perubahan Struktur Data (Prisma)

Untuk mendukung fitur ini, model `Organization` (atau tabel konfigurasi instance) perlu diperbarui:

```prisma
model Organization {
  // ... field yang sudah ada
  activation_mode      String    @default("ONLINE") // ONLINE | OFFLINE
  kms_center_username  String?
  kms_center_password  String?   // Disimpan terenkripsi
  license_key          String?   @db.Text
  license_issued_at    DateTime?
}
```

---

## 3. Implementasi Teknis

### A. Fingerprint Hardware (Mode OFFLINE)
Token sidik jari perangkat dihasilkan menggunakan informasi hardware unik (CPU ID, Hostname, Platform, dll) melalui `LicenseService`.

**Logika Pembuatan:**
```typescript
// Lokasi: lib/services/license-service.ts
private generateFingerprint(): string {
    const data = `${os.platform()}-${os.release()}-${os.hostname()}-${os.cpus().length}-${os.totalmem()}`;
    return crypto.createHash('md5').update(data).digest('hex');
}
```

### B. Otentikasi Center (Mode ONLINE)
Klien mengirimkan kredensial ke API DiamondKMS Center untuk mendapatkan token akses atau status aktivasi.

---

## 4. Antarmuka Pengguna (UI Settings)

Halaman pengaturan pada menu **Setting > Activation** akan diperbarui dengan elemen berikut:

### 1. Toggle Mode
Pilihan saklar antara mode ONLINE dan OFFLINE.

### 2. Form Mode ONLINE
- **Username Field**: Input username klien KMS Center.
- **Password Field**: Input password (masked).
- **Button Connect**: Menguji koneksi ke Center.

### 3. Form Mode OFFLINE
- **Display Fingerprint**: Menampilkan token yang dihasilkan sistem (Read-only).
- **License Key Field**: Textarea untuk memasukkan kunci lisensi yang diberikan oleh tim Weldn/Movio.
- **Button Activate**: Memvalidasi kunci secara lokal menggunakan `LICENSE_SECRET`.

---

## 5. Alur Aktivasi

### Alur OFFLINE:
1. User masuk ke menu **Activation**.
2. Memilih **OFFLINE Mode**.
3. Sistem menampilkan **Fingerprint Token**.
4. User memberikan token tersebut ke tim Weldn/Movio.
5. Tim memberikan **License Key**.
6. User memasukkan key tersebut ke aplikasi dan klik **Simpan/Aktifkan**.

### Alur ONLINE:
1. User masuk ke menu **Activation**.
2. Memilih **ONLINE Mode**.
3. User memasukkan **Username & Password** DiamondKMS Center.
4. Klik **Hubungkan**.
5. Sistem melakukan registrasi instance ke Center secara otomatis.

---

## 6. Keamanan
- Password DiamondKMS Center harus dienkripsi menggunakan `ENCRYPTION_KEY` sebelum disimpan di DB.
- License Key OFFLINE harus divalidasi integritanya menggunakan signature digital atau hashing HMAC.
