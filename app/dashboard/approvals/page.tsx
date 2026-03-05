'use client'

import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getApprovalQueueAction, reviewApprovalAction } from '@/lib/actions/approval.actions'
import { CheckCircle, XCircle, Search, Eye, FileText } from 'lucide-react'
import Link from 'next/link'
import { RoleGuard } from '@/components/shared/RoleGuard'

export default function ApprovalsPage() {
    const { organization, user, role, division } = useCurrentUser()
    const [queues, setQueues] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Modal state for rejection note
    const [isRejectOpen, setIsRejectOpen] = useState(false)
    const [selectedQueue, setSelectedQueue] = useState<any>(null)
    const [rejectNote, setRejectNote] = useState('')
    const [processingId, setProcessingId] = useState<string | null>(null)

    const loadData = async () => {
        if (!organization?.id) return
        // GROUP_ADMIN (Kadiv) hanya lihat approval divisi sendiri
        const divFilter = role === 'GROUP_ADMIN' ? division?.id : undefined
        const res = await getApprovalQueueAction(organization.id, divFilter)
        if (res.success) {
            setQueues(res.data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [organization?.id, division?.id])

    const handleApprove = async (id: string) => {
        if (!user || !confirm('Approve and publish this article?')) return
        setProcessingId(id)

        const res = await reviewApprovalAction(id, user.id, 'APPROVED')
        if (res.success) {
            loadData()
        } else {
            alert(res.error || 'Failed to approve content')
        }
        setProcessingId(null)
    }

    const openRejectModal = (q: any) => {
        setSelectedQueue(q)
        setRejectNote('')
        setIsRejectOpen(true)
    }

    const handleReject = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !selectedQueue) return
        setProcessingId(selectedQueue.id)

        const res = await reviewApprovalAction(selectedQueue.id, user.id, 'REJECTED', rejectNote)
        if (res.success) {
            setIsRejectOpen(false)
            loadData()
        } else {
            alert(res.error || 'Failed to reject content')
        }
        setProcessingId(null)
    }

    const filteredQueues = queues.filter(q =>
        q.content?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.submitter_name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'GROUP_ADMIN']}>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold font-display text-navy-900 flex items-center gap-2">
                        <FileText size={24} className="text-navy-600" /> Content Approval Queue
                    </h1>
                </div>

                <div className="card">
                    <div className="p-4 border-b flex justify-between items-center">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-300" size={18} />
                            <input
                                type="text"
                                placeholder="Search requested titles/authors..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border rounded-md w-full focus:ring-navy-600 focus:border-navy-600"
                            />
                        </div>
                        <div className="text-sm font-medium text-text-500 bg-surface-50 px-3 py-1.5 rounded border shadow-sm">
                            {queues.length} Pending
                        </div>
                    </div>

                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-50 text-text-500 text-sm border-b">
                                <th className="p-4 font-medium">Article requested</th>
                                <th className="p-4 font-medium">Division</th>
                                <th className="p-4 font-medium">Submitted by</th>
                                <th className="p-4 font-medium">Date</th>
                                <th className="p-4 font-medium w-48 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-text-500">Loading queue...</td></tr>
                            ) : filteredQueues.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center text-text-500">
                                    <CheckCircle size={40} className="mx-auto text-green-300 mb-3" />
                                    All caught up! No pending approvals.
                                </td></tr>
                            ) : (
                                filteredQueues.map((q) => (
                                    <tr key={q.id} className="border-b last:border-0 hover:bg-surface-50">
                                        <td className="p-4">
                                            <Link href={`/dashboard/contents/${q.content_id}`} target="_blank" className="font-medium text-navy-600 hover:underline flex items-center gap-2">
                                                <Eye size={16} /> {q.content?.title || 'Unknown Title'}
                                            </Link>
                                        </td>
                                        <td className="p-4 text-sm text-text-500">
                                            {q.content?.division?.name || 'General'}
                                        </td>
                                        <td className="p-4 text-sm text-navy-900 font-medium">
                                            {q.submitter_name}
                                        </td>
                                        <td className="p-4 text-sm text-text-500">
                                            {new Date(q.submitted_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => openRejectModal(q)}
                                                    disabled={processingId === q.id}
                                                    className="px-3 py-1.5 text-sm text-danger bg-danger-bg hover:bg-danger-bg rounded border border-red-200 transition font-medium flex items-center gap-1"
                                                >
                                                    <XCircle size={14} /> Reject
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(q.id)}
                                                    disabled={processingId === q.id}
                                                    className="px-3 py-1.5 text-sm text-green-700 bg-success-bg hover:bg-green-100 rounded border border-green-200 transition font-medium flex items-center gap-1"
                                                >
                                                    <CheckCircle size={14} /> Approve
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reject Modal */}
            {isRejectOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-xl font-bold font-display mb-1 text-navy-900">Reject Approval</h2>
                        <p className="text-sm text-text-500 mb-4">You are returning the article "{selectedQueue?.content?.title}" to its author.</p>

                        <form onSubmit={handleReject}>
                            <label className="block text-sm font-medium mb-1 text-text-700">Reason for rejection (Optional)</label>
                            <textarea
                                value={rejectNote}
                                onChange={(e) => setRejectNote(e.target.value)}
                                className="w-full border-surface-200 border rounded-md p-2.5 h-24 focus:ring-navy-600 focus:border-navy-600"
                                placeholder="E.g. Please add more details to section 3..."
                            />

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsRejectOpen(false)} className="px-4 py-2 text-text-500 hover:bg-surface-100 rounded">Cancel</button>
                                <button type="submit" disabled={processingId === selectedQueue?.id} className="btn btn-danger">
                                    <XCircle size={16} /> Reject Article
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </RoleGuard>
    )
}
