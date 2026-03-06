'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { Role } from '@prisma/client'
import { getDivisionsAction, getUsersAction, updateUserRoleAction, deactivateUserAction } from '@/lib/actions/user.actions'
import { ArrowLeft, Save, Loader2, User as UserIcon, Building2, Shield, UserX } from 'lucide-react'

export default function EditUserPage({ params }: { params: { id: string } }) {
    const { organization } = useCurrentUser()
    const router = useRouter()

    const [divisions, setDivisions] = useState<any[]>([])
    const [editingUser, setEditingUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const [role, setRole] = useState<Role>(Role.STAFF)
    const [divisionId, setDivisionId] = useState('')
    const [submitStatus, setSubmitStatus] = useState({ type: '', msg: '' })

    useEffect(() => {
        const loadData = async () => {
            if (!organization?.id) return

            // Note: Since we don't have a single `getUserAction(id)` exposed yet,
            // we will fetch `getUsersAction` as done on the listing page and find our user.
            const [usersRes, divRes] = await Promise.all([
                getUsersAction(organization.id),
                getDivisionsAction(organization.id)
            ])

            if (divRes.success) {
                setDivisions(divRes.data || [])
            }

            if (usersRes.success) {
                const userObj = usersRes.data?.find((u: any) => u.id === params.id)
                if (userObj) {
                    setEditingUser(userObj)
                    if (userObj.user_divisions?.length > 0) {
                        setRole(userObj.user_divisions[0].role)
                        setDivisionId(userObj.user_divisions[0].division_id)
                    }
                } else {
                    setSubmitStatus({ type: 'error', msg: 'User tidak ditemukan' })
                }
            }
            setLoading(false)
        }

        loadData()
    }, [organization?.id, params.id])

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitStatus({ type: 'loading', msg: 'Memperbarui user...' })

        // Validate division selection
        if (!divisionId) {
            setSubmitStatus({ type: 'error', msg: 'Mohon pilih divisi utama.' })
            return
        }

        const res = await updateUserRoleAction(editingUser.id, role, divisionId)
        if (res.success) {
            setSubmitStatus({ type: 'success', msg: 'User berhasil diperbarui. Mengalihkan...' })
            setTimeout(() => {
                router.push('/dashboard/hrd/users')
            }, 1000)
        } else {
            setSubmitStatus({ type: 'error', msg: res.error || 'Gagal memperbarui user' })
        }
    }

    const handleDeactivate = async () => {
        if (!confirm('Apakah Anda yakin ingin menonaktifkan user ini?')) return
        setSubmitStatus({ type: 'loading', msg: 'Menonaktifkan...' })

        const res = await deactivateUserAction(editingUser.id)
        if (res.success) {
            setSubmitStatus({ type: 'success', msg: 'User dinonaktifkan. Mengalihkan...' })
            setTimeout(() => router.push('/dashboard/hrd/users'), 1000)
        } else {
            setSubmitStatus({ type: 'error', msg: res.error || 'Gagal menonaktifkan user' })
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin mb-4" />
                <p className="text-text-500 font-medium">Memuat data user...</p>
            </div>
        )
    }

    if (!editingUser) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <UserX size={48} className="text-surface-300 mb-4" />
                <h2 className="text-xl font-bold font-display text-navy-900">User Tidak Ditemukan</h2>
                <p className="text-text-500 mb-6">Mungkin user sudah dihapus atau ada kesalahan ID.</p>
                <Link href="/dashboard/hrd/users" className="btn btn-primary">
                    Kembali ke Daftar User
                </Link>
            </div>
        )
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'GROUP_ADMIN']}>
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/hrd/users"
                        className="p-2 hover:bg-surface-100 rounded-lg text-text-500 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight">Edit User</h1>
                        <p className="text-sm text-text-500 mt-1">Ubah role atau pindah divisi untuk anggota {editingUser.full_name}.</p>
                    </div>
                </div>

                <div className="card overflow-hidden">
                    <div className="p-6 border-b border-surface-200 bg-surface-50 flex items-center gap-4">
                        <div className="w-12 h-12 bg-navy-100 text-navy-600 rounded-full flex items-center justify-center shrink-0">
                            <UserIcon size={24} />
                        </div>
                        <div>
                            <h2 className="font-bold text-navy-900 font-display text-lg">{editingUser.full_name}</h2>
                            <p className="text-text-500 text-sm">{editingUser.job_title || 'Tidak ada posisi jabatan'}</p>
                        </div>
                    </div>

                    <div className="p-6">
                        {submitStatus.msg && (
                            <div className={`p-4 rounded-xl mb-6 text-sm font-medium flex items-center gap-2 ${submitStatus.type === 'error' ? 'bg-danger-bg text-danger border border-danger/20'
                                    : submitStatus.type === 'success' ? 'bg-success-bg text-success border border-success/20'
                                        : 'bg-navy-50 text-navy-600 border border-navy-100'
                                }`}>
                                {submitStatus.type === 'loading' && <Loader2 size={16} className="animate-spin" />}
                                {submitStatus.msg}
                            </div>
                        )}

                        <form onSubmit={handleUpdate} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Role Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                                        <Shield size={16} className="text-navy-500" />
                                        Role Akses (Hak Akses)
                                    </label>
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value as Role)}
                                        className="input-field w-full text-sm"
                                    >
                                        <option value="STAFF">Staff (Akses Default)</option>
                                        <option value="SUPERVISOR">Supervisor (Reviewer)</option>
                                        <option value="GROUP_ADMIN">Group Admin (Kepala Divisi)</option>
                                        <option value="SUPER_ADMIN">Super Admin (HRD / Global)</option>
                                    </select>
                                    <p className="text-xs text-text-400">
                                        Menentukan hak ases fitur yang dapat dilihat user ini dalam sistem.
                                    </p>
                                </div>

                                {/* Division Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                                        <Building2 size={16} className="text-navy-500" />
                                        Divisi Utama
                                    </label>
                                    <select
                                        required
                                        value={divisionId}
                                        onChange={(e) => setDivisionId(e.target.value)}
                                        className="input-field w-full text-sm"
                                    >
                                        <option value="">Pilih Divisi...</option>
                                        {divisions.map((d) => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-text-400">
                                        Dokumen & SOP dari divisi akan diberikan otomatis.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-surface-200 flex flex-col-reverse md:flex-row justify-between items-center gap-4">
                                <button
                                    type="button"
                                    onClick={handleDeactivate}
                                    className="px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger-bg rounded-lg transition-colors flex items-center gap-2 w-full md:w-auto justify-center"
                                >
                                    <UserX size={16} />
                                    Nonaktifkan User
                                </button>

                                <div className="flex gap-3 w-full md:w-auto">
                                    <Link
                                        href="/dashboard/hrd/users"
                                        className="btn btn-secondary flex-1 md:flex-none justify-center"
                                    >
                                        Batal
                                    </Link>
                                    <button
                                        type="submit"
                                        disabled={submitStatus.type === 'loading'}
                                        className="btn btn-primary flex-1 md:flex-none justify-center flex items-center gap-2"
                                    >
                                        {submitStatus.type === 'loading' ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Save size={16} />
                                        )}
                                        Simpan Perubahan
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </RoleGuard>
    )
}
