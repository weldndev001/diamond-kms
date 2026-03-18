'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { createDivisionAction } from '@/lib/actions/user.actions'
import { ArrowLeft, Building2, Loader2, Save } from 'lucide-react'
import Link from 'next/link'

export default function CreateDivisionPage() {
    const { organization } = useCurrentUser()
    const router = useRouter()

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [status, setStatus] = useState({ type: '', msg: '' })

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!organization?.id) return

        setStatus({ type: 'loading', msg: 'Creating division...' })
        const res = await createDivisionAction({ name, description, orgId: organization.id })

        if (res.success) {
            setStatus({ type: 'success', msg: 'Division created successfully! Redirecting...' })
            setTimeout(() => {
                router.push('/dashboard/hrd/users/divisions')
                router.refresh()
            }, 1000)
        } else {
            setStatus({ type: 'error', msg: res.error || 'Failed to create division' })
        }
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN']}>
            <div className="space-y-6 max-w-3xl animate-in fade-in duration-300">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/hrd/users/divisions" className="p-2 hover:bg-surface-100 rounded-lg transition-colors text-text-500 hover:text-navy-700">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold font-display text-navy-900 flex items-center gap-2">
                            <Building2 size={24} className="text-navy-600" />
                            Create New Division
                        </h1>
                        <p className="text-sm text-text-500 mt-1">Add a new division or department to the organization.</p>
                    </div>
                </div>

                <div className="card p-6">
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

                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-navy-900">
                                Division Name <span className="text-danger">*</span>
                            </label>
                            <input
                                required
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="input-field"
                                placeholder="e.g.: Finance, HRD, IT Support"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-navy-900">
                                Description <span className="text-text-400 font-normal">(Optional)</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="input-field min-h-[120px] resize-y"
                                placeholder="Briefly describe the roles and responsibilities of this division..."
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
                            <Link
                                href="/dashboard/hrd/users/divisions"
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
                                    <Save size={16} />
                                )}
                                Save Division
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </RoleGuard>
    )
}
