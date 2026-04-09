'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { Role } from '@prisma/client'
import { getDivisionsAction, getUsersAction, updateUserAction, deactivateUserAction } from '@/lib/actions/user.actions'
import { ArrowLeft, Save, Loader2, User as UserIcon, Building2, Shield, UserX, Mail, Briefcase, Lock, Eye, EyeOff } from 'lucide-react'

export default function EditUserPage({ params }: { params: { id: string } }) {
    const { organization, role: currentUserRole, division: currentDivision } = useCurrentUser()
    const router = useRouter()

    const [divisions, setDivisions] = useState<any[]>([])
    const [editingUser, setEditingUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [jobTitle, setJobTitle] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [role, setRole] = useState<Role>(Role.STAFF)
    const [divisionId, setDivisionId] = useState('')
    const [submitStatus, setSubmitStatus] = useState({ type: '', msg: '' })

    useEffect(() => {
        const loadData = async () => {
            if (!organization?.id) return

            const usersRes = await getUsersAction(organization.id)
            const divRes = await getDivisionsAction(organization.id)

            if (divRes.success) {
                let divData = divRes.data || []
                if (currentUserRole === 'GROUP_ADMIN' && currentDivision?.id) {
                    divData = divData.filter((d: any) => d.id === currentDivision.id)
                }
                setDivisions(divData)
            }

            if (usersRes.success) {
                const userObj = usersRes.data?.find((u: any) => u.id === params.id)
                if (userObj) {
                    // Security Check: if GROUP_ADMIN, verify division
                    if (currentUserRole === 'GROUP_ADMIN' && currentDivision?.id) {
                        const userDiv = userObj.user_divisions?.find((ud: any) => ud.is_primary) || userObj.user_divisions?.[0]
                        if (userDiv?.division_id !== currentDivision.id) {
                            setSubmitStatus({ type: 'error', msg: 'Anda tidak memiliki izin untuk mengedit user dari divisi lain.' })
                            setLoading(false)
                            return
                        }
                    }

                    setEditingUser(userObj)
                    setFullName(userObj.full_name || '')
                    setEmail(userObj.email || '')
                    setJobTitle(userObj.job_title || '')
                    
                    if (userObj.user_divisions?.length > 0) {
                        const primaryDiv = userObj.user_divisions.find((ud: any) => ud.is_primary) || userObj.user_divisions[0]
                        setRole(primaryDiv.role as Role)
                        setDivisionId(primaryDiv.division_id)
                    }
                } else {
                    setSubmitStatus({ type: 'error', msg: 'User not found' })
                }
            }
            setLoading(false)
        }

        loadData()
    }, [organization?.id, params.id, currentUserRole, currentDivision?.id])

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitStatus({ type: 'loading', msg: 'Updating user...' })

        // Validate division selection
        if (!divisionId) {
            setSubmitStatus({ type: 'error', msg: 'Please select a primary division.' })
            return
        }

        const res = await updateUserAction({
            id: editingUser.id,
            fullName,
            email,
            jobTitle,
            role,
            divisionId,
            password
        })

        if (res.success) {
            setSubmitStatus({ type: 'success', msg: 'User updated successfully. Redirecting...' })
            setTimeout(() => {
                router.push('/dashboard/hrd/users')
            }, 1000)
        } else {
            setSubmitStatus({ type: 'error', msg: res.error || 'Failed to update user' })
        }
    }

    const handleDeactivate = async () => {
        if (!confirm('Are you sure you want to deactivate this user?')) return
        setSubmitStatus({ type: 'loading', msg: 'Deactivating...' })

        const res = await deactivateUserAction(editingUser.id)
        if (res.success) {
            setSubmitStatus({ type: 'success', msg: 'User deactivated. Redirecting...' })
            setTimeout(() => router.push('/dashboard/hrd/users'), 1000)
        } else {
            setSubmitStatus({ type: 'error', msg: res.error || 'Failed to deactivate user' })
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin mb-4" />
                <p className="text-text-500 font-medium">Loading user data...</p>
            </div>
        )
    }

    if (!editingUser) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <UserX size={48} className="text-surface-300 mb-4" />
                <h2 className="text-xl font-bold font-display text-navy-900">User Not Found</h2>
                <p className="text-text-500 mb-6">User might have been deleted or there is an ID error.</p>
                <Link href="/dashboard/hrd/users" className="btn btn-primary">
                    Back to User List
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
                        <p className="text-sm text-text-500 mt-1">Change role or move division for member {editingUser.full_name}.</p>
                    </div>
                </div>

                <div className="card overflow-hidden">
                    <div className="p-6 border-b border-surface-200 bg-surface-50 flex items-center gap-4">
                        <div className="w-12 h-12 bg-navy-100 text-navy-600 rounded-full flex items-center justify-center shrink-0">
                            <UserIcon size={24} />
                        </div>
                        <div>
                            <h2 className="font-bold text-navy-900 font-display text-lg">{editingUser.full_name}</h2>
                            <p className="text-text-500 text-sm">{editingUser.job_title || 'No job title position'}</p>
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
                                {/* Full Name */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                                        <UserIcon size={16} className="text-navy-500" />
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="input-field w-full text-sm"
                                        placeholder="Enter full name"
                                    />
                                </div>

                                {/* Email Address */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                                        <Mail size={16} className="text-navy-500" />
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="input-field w-full text-sm"
                                        placeholder="email@example.com"
                                    />
                                </div>

                                {/* Job Title */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                                        <Briefcase size={16} className="text-navy-500" />
                                        Job Title / Position
                                    </label>
                                    <input
                                        type="text"
                                        value={jobTitle}
                                        onChange={(e) => setJobTitle(e.target.value)}
                                        className="input-field w-full text-sm"
                                        placeholder="e.g. Sales Manager"
                                    />
                                </div>

                                {/* Password */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                                        <Lock size={16} className="text-navy-500" />
                                        Password (Hidden)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="input-field w-full text-sm pr-10"
                                            placeholder="Leave empty to keep current password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-400 hover:text-navy-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-text-400">
                                        Password is encrypted and cannot be displayed for security. Enter new password to change.
                                    </p>
                                </div>

                                {/* Role Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                                        <Shield size={16} className="text-navy-500" />
                                        Access Role (Permissions)
                                    </label>
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value as Role)}
                                        className="input-field w-full text-sm"
                                    >
                                        <option value="STAFF">Staff (Default Access)</option>
                                        <option value="SUPERVISOR">Supervisor (Reviewer)</option>
                                        <option value="GROUP_ADMIN">Group Admin (Division Head)</option>
                                        {currentUserRole === 'SUPER_ADMIN' && (
                                            <option value="SUPER_ADMIN">Super Admin (HR / Global)</option>
                                        )}
                                    </select>
                                    <p className="text-xs text-text-400">
                                        Determines the feature access rights this user can see in the system.
                                    </p>
                                </div>

                                {/* Division Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                                        <Building2 size={16} className="text-navy-500" />
                                        Primary Division
                                    </label>
                                    <select
                                        required
                                        value={divisionId}
                                        onChange={(e) => setDivisionId(e.target.value)}
                                        className="input-field w-full text-sm disabled:bg-surface-100"
                                        disabled={currentUserRole === 'GROUP_ADMIN'}
                                    >
                                        <option value="">Select Division...</option>
                                        {divisions.map((d) => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-text-400">
                                        {currentUserRole === 'GROUP_ADMIN' 
                                            ? 'Anda hanya dapat mengelola user di divisi Anda sendiri.' 
                                            : 'Documents & SOPs from the division will be given automatically.'}
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
                                    Deactivate User
                                </button>

                                <div className="flex gap-3 w-full md:w-auto">
                                    <Link
                                        href="/dashboard/hrd/users"
                                        className="btn btn-secondary flex-1 md:flex-none justify-center"
                                    >
                                        Cancel
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
                                        Save Changes
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
