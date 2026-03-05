'use client'

import { useState } from 'react'
import { Role } from '@prisma/client'
import { inviteUserAction } from '@/lib/actions/auth.actions'
import { X, UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function InviteUserModal({
    isOpen,
    onClose,
    divisions,
    creatorRole
}: {
    isOpen: boolean
    onClose: () => void
    divisions: any[]
    creatorRole?: string
}) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [fullName, setFullName] = useState('')
    const [jobTitle, setJobTitle] = useState('')
    const [role, setRole] = useState<Role>(Role.STAFF)
    const [divisionId, setDivisionId] = useState('')
    const [status, setStatus] = useState({ type: '', msg: '' })

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setStatus({ type: 'loading', msg: 'Membuat akun user...' })

        const res = await inviteUserAction({ email, password, fullName, jobTitle, role, divisionId })
        if (res.success) {
            setStatus({ type: 'success', msg: 'User berhasil dibuat! Bisa langsung login.' })
            setTimeout(() => {
                onClose()
                setStatus({ type: '', msg: '' })
                // Reset form
                setEmail('')
                setPassword('')
                setFullName('')
                setJobTitle('')
                setRole(Role.STAFF)
                setDivisionId('')
            }, 1500)
        } else {
            setStatus({ type: 'error', msg: res.error || 'Gagal membuat user' })
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-navy-600 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <UserPlus size={20} />
                        <h2 className="text-lg font-bold font-display">Buat User Baru</h2>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {status.msg && (
                        <div className={`p-3 rounded-lg mb-4 text-sm font-medium ${status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100'
                            : status.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100'
                                : 'bg-blue-50 text-blue-600 border border-blue-100'
                            }`}>
                            {status.msg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-semibold text-navy-900 mb-1">Nama Lengkap</label>
                                <input
                                    required
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="contoh: Budi Santoso"
                                    className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-navy-900 mb-1">Email</label>
                                <input
                                    required
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="budi@perusahaan.com"
                                    className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-navy-900 mb-1">Password</label>
                                <div className="relative">
                                    <input
                                        required
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Min. 6 karakter"
                                        minLength={6}
                                        className="w-full border border-surface-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none transition"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-400 hover:text-navy-600 transition"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-navy-900 mb-1">Jabatan</label>
                                <input
                                    type="text"
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                    placeholder="contoh: Staff HR"
                                    className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-navy-900 mb-1">Role</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as Role)}
                                    className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none transition bg-white"
                                >
                                    <option value="STAFF">Staff</option>
                                    <option value="SUPERVISOR">Supervisor</option>
                                    {/* Kadiv (GROUP_ADMIN) hanya bisa buat Staff & Supervisor */}
                                    {creatorRole !== 'GROUP_ADMIN' && (
                                        <option value="GROUP_ADMIN">Group Admin (KaDiv)</option>
                                    )}
                                    {/* Hanya MAINTAINER yang bisa buat SUPER_ADMIN */}
                                    {creatorRole === 'MAINTAINER' && (
                                        <option value="SUPER_ADMIN">Super Admin (HRD)</option>
                                    )}
                                </select>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-semibold text-navy-900 mb-1">Divisi</label>
                                <select
                                    required
                                    value={divisionId}
                                    onChange={(e) => setDivisionId(e.target.value)}
                                    className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none transition bg-white"
                                >
                                    <option value="">Pilih Divisi...</option>
                                    {divisions.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 text-sm font-medium text-text-600 hover:bg-surface-100 rounded-lg transition"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={status.type === 'loading'}
                                className="px-5 py-2.5 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                            >
                                {status.type === 'loading' ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <UserPlus size={16} />
                                )}
                                Buat Akun
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
