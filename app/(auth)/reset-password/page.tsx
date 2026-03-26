'use client'

import Link from 'next/link'

export default function ResetPasswordPage() {
    return (
        <div>
            <h2 className="text-2xl font-bold font-display mb-6 text-navy-900">Reset your password</h2>
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md mb-6 text-sm">
                <p className="font-semibold mb-2">Pemberitahuan Migrasi Sistem</p>
                Fitur pengaturan ulang kata sandi mandiri saat ini sedang dalam proses migrasi ke infrastruktur baru.
            </div>
            
            <p className="text-sm text-text-500 mb-6">
                Silakan hubungi <strong>Administrator Sistem</strong> atau atasan Anda untuk bantuan pengaturan ulang kata sandi akun Anda.
            </p>

            <div className="mt-6 text-center text-sm">
                <Link href="/login" className="font-medium text-navy-600 hover:text-navy-600">
                    Kembali ke halaman login
                </Link>
            </div>
        </div>
    )
}
