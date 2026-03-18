'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Role } from '@prisma/client'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { inviteUserAction } from '@/lib/actions/auth.actions'
import { getDivisionsAction } from '@/lib/actions/user.actions'
import { ArrowLeft, UserPlus, Eye, EyeOff, Loader2, Save } from 'lucide-react'
import Link from 'next/link'

export default function CreateUserPage() {
    const { organization, role: currentUserRole } = useCurrentUser()
    const router = useRouter()

    const [divisions, setDivisions] = useState<any[]>([])
    const [isLoadingDivisions, setIsLoadingDivisions] = useState(true)

    // Form State
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [fullName, setFullName] = useState('')
    const [jobTitle, setJobTitle] = useState('')
    const [role, setRole] = useState<Role>(Role.STAFF)
    const [divisionId, setDivisionId] = useState('')
    const [status, setStatus] = useState({ type: '', msg: '' })

    useEffect(() => {
        async function loadDivisions() {
            if (!organization?.id) return
            const res = await getDivisionsAction(organization.id)
            if (res.success) {
                setDivisions(res.data || [])
            }
            setIsLoadingDivisions(false)
        }
        loadDivisions()
    }, [organization?.id])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setStatus({ type: 'loading', msg: 'Creating user account...' })

        const res = await inviteUserAction({ email, password, fullName, jobTitle, role, divisionId })
        if (res.success) {
            setStatus({ type: 'success', msg: 'User created successfully! Redirecting...' })
            setTimeout(() => {
                router.push('/dashboard/hrd/users')
                router.refresh()
            }, 1000)
        } else {
            setStatus({ type: 'error', msg: res.error || 'Failed to create user' })
        }
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'GROUP_ADMIN']}>
            <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/hrd/users" className="p-2 hover:bg-surface-100 rounded-lg transition-colors text-text-500 hover:text-navy-700">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold font-display text-navy-900 flex items-center gap-2">
                            <UserPlus size={24} className="text-navy-600" />
                            Create New User
                        </h1>
                        <p className="text-sm text-text-500 mt-1">Add a new member to this organization.</p>
                    </div>
                </div>

                <div className="card p-6 md:p-8">
                    {status.msg && (
                        <div className={`p-4 rounded-lg mb-6 text-sm font-medium border ${status.type === 'error' ? 'bg-danger-bg text-danger border-red-200'
                            : status.type === 'success' ? 'bg-success-bg text-success border-green-200'
                                : 'bg-info-bg text-info border-blue-200'
                            }`}>
                            <div className="flex items-center gap-2">
                                {status.type === 'loading' && <Loader2 size={16} className="animate-spin" />}
                                {status.msg}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-navy-900 mb-1">
                                    Full Name <span className="text-danger">*</span>
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="e.g.: John Doe"
                                    className="input-field"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-navy-900 mb-1">
                                    Email <span className="text-danger">*</span>
                                </label>
                                <input
                                    required
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="budi@perusahaan.com"
                                    className="input-field"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-navy-900 mb-1">
                                    Password <span className="text-danger">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        required
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Min. 6 characters"
                                        minLength={6}
                                        className="input-field pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-400 hover:text-navy-600 transition p-1"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-navy-900 mb-1">
                                    Job Title <span className="text-text-400 font-normal">(Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                    placeholder="e.g.: HR Staff"
                                    className="input-field"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-navy-900 mb-1">
                                    Access Role <span className="text-danger">*</span>
                                </label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as Role)}
                                    className="input-field bg-white"
                                >
                                    <option value="STAFF">Staff</option>
                                    <option value="SUPERVISOR">Supervisor</option>
                                    <option value="GROUP_ADMIN">Group Admin (Div. Head)</option>
                                    <option value="SUPER_ADMIN">Super Admin</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-navy-900 mb-1">
                                    Placement Division <span className="text-danger">*</span>
                                </label>
                                <select
                                    required
                                    value={divisionId}
                                    onChange={(e) => setDivisionId(e.target.value)}
                                    className="input-field bg-white"
                                    disabled={isLoadingDivisions}
                                >
                                    <option value="">
                                        {isLoadingDivisions ? 'Loading divisions...' : 'Select Division...'}
                                    </option>
                                    {divisions.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-surface-200">
                            <Link
                                href="/dashboard/hrd/users"
                                className="btn border border-surface-300 bg-white text-text-700 hover:bg-surface-50"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={status.type === 'loading'}
                                className="btn btn-primary flex items-center gap-2"
                            >
                                {status.type === 'loading' ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <UserPlus size={16} />
                                )}
                                Create User Account
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </RoleGuard>
    )
}
