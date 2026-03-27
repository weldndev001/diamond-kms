'use client'

import { useState, useEffect } from 'react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getDivisionsAction, deleteDivisionAction } from '@/lib/actions/user.actions'
import { Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function DivisionsPage() {
    const { organization } = useCurrentUser()
    const [divisions, setDivisions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const loadData = async () => {
        if (!organization?.id) return
        const res = await getDivisionsAction(organization.id)
        if (res.success) {
            setDivisions(res.data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [organization?.id])

    const handleDelete = async (divId: string) => {
        if (!confirm('Warning: Deleting a division cannot be undone. Make sure no users/contents are attached. Proceed?')) return

        const res = await deleteDivisionAction(divId)
        if (res.success) {
            loadData()
        } else {
            alert(res.error || 'Failed to delete division')
        }
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN']}>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold font-display text-navy-900">Divisi Management</h1>
                        <p className="text-sm text-text-500 mt-1">Kelola divisi organisasi Anda.</p>
                    </div>
                    <Link
                        href="/dashboard/hrd/users/divisions/new"
                        className="btn btn-primary flex flex-row items-center gap-2"
                    >
                        <Plus size={18} /> Add Division
                    </Link>
                </div>

                {/* Navigation tabs removed - moved to sidebar */}

                <div className="card">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-50 text-text-500 text-sm border-b">
                                <th className="p-4 font-medium">Division Name</th>
                                <th className="p-4 font-medium">Description</th>
                                <th className="p-4 font-medium">Members</th>
                                <th className="p-4 font-medium w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-text-500">Loading divisions...</td></tr>
                            ) : divisions.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-text-500">No divisions found.</td></tr>
                            ) : (
                                divisions.map((d) => (
                                    <tr key={d.id} className="border-b last:border-0 hover:bg-surface-50">
                                        <td className="p-4 font-medium text-navy-900">{d.name}</td>
                                        <td className="p-4 text-sm text-text-500">{d.description || '-'}</td>
                                        <td className="p-4">
                                            <span className="inline-block px-2 py-1 bg-surface-100 text-text-500 font-medium text-xs rounded border">
                                                {d._count?.user_divisions || 0} users
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <button onClick={() => handleDelete(d.id)} className="p-2 text-text-300 hover:text-danger rounded-md transition" title="Delete Division">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </RoleGuard>
    )
}
