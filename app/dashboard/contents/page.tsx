'use client'

import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getContentsAction, deleteContentAction } from '@/lib/actions/content.actions'
import { Plus, Search, Eye, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function ContentsPage() {
    const { organization, role, division } = useCurrentUser()
    const [contents, setContents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const isStaff = role === 'STAFF'

    const loadData = async () => {
        if (!organization?.id) return
        // Non-admin roles (STAFF, SUPERVISOR, GROUP_ADMIN) only see their own division's content
        const isAdmin = role === 'SUPER_ADMIN' || role === 'MAINTAINER'
        const divFilter = !isAdmin ? division?.id : undefined
        const res = await getContentsAction(organization.id, divFilter)
        if (res.success) {
            setContents(res.data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [organization?.id, division?.id])

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this article?')) return
        const res = await deleteContentAction(id)
        if (res.success) {
            loadData()
        } else {
            alert(res.error || 'Failed to delete content')
        }
    }

    const filteredContents = contents.filter(c =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.author_name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold font-display text-navy-900">Knowledge Base</h1>
                {['SUPER_ADMIN', 'GROUP_ADMIN', 'SUPERVISOR', 'MAINTAINER'].includes(role || '') && (
                    <Link
                        href="/dashboard/contents/create"
                        className="btn btn-primary"
                    >
                        <Plus size={18} /> Create Article
                    </Link>
                )}
            </div>

            <div className="card">
                <div className="p-4 border-b flex justify-between items-center">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-300" size={18} />
                        <input
                            type="text"
                            placeholder="Search articles..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-md w-full focus:ring-navy-600 focus:border-navy-600"
                        />
                    </div>
                </div>

                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-surface-50 text-text-500 text-sm border-b">
                            <th className="p-4 font-medium">Title</th>
                            <th className="p-4 font-medium">Division</th>
                            <th className="p-4 font-medium">Author</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium w-32">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-text-500">Loading records...</td></tr>
                        ) : filteredContents.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-text-500">No content found.</td></tr>
                        ) : (
                            filteredContents.map((c) => (
                                <tr key={c.id} className="border-b last:border-0 hover:bg-surface-50">
                                    <td className="p-4 font-medium text-navy-900">
                                        <Link href={`/dashboard/contents/${c.id}`} className="hover:text-navy-600 hover:underline">
                                            {c.title}
                                        </Link>
                                    </td>
                                    <td className="p-4 text-sm text-text-500">
                                        {c.division?.name || '-'}
                                    </td>
                                    <td className="p-4 text-sm text-text-500">
                                        {c.author_name}
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-block px-2 py-1 text-xs rounded border font-medium ${c.status === 'PUBLISHED' ? 'bg-green-100 text-green-700 border-green-200' :
                                            c.status === 'PENDING_APPROVAL' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                'bg-surface-100 text-text-700 border-surface-200'
                                            }`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <Link href={`/dashboard/contents/${c.id}`} className="p-2 text-navy-600 hover:bg-navy-50 rounded" title="Read Article">
                                                <Eye size={18} />
                                            </Link>
                                            {['SUPER_ADMIN', 'GROUP_ADMIN', 'MAINTAINER'].includes(role || '') && (
                                                <button onClick={() => handleDelete(c.id)} className="p-2 text-danger hover:bg-danger-bg rounded" title="Delete Article">
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
