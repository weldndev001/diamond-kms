'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getContentByIdAction, updateContentAction } from '@/lib/actions/content.actions'
import { getGroupsAction } from '@/lib/actions/user.actions'
import { Save, ArrowLeft, BookOpen, Search, X, CheckCircle2, Upload, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { TiptapEditor } from '@/components/editor/TiptapEditor'
import { uploadFileAction } from '@/lib/actions/storage.actions'
import { Role } from '@prisma/client'
import ImageCropper from '@/components/shared/ImageCropper'
import { Scissors } from 'lucide-react'
import { compressImage } from '@/lib/utils/image'

export default function EditContentPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const { user, organization, role, group } = useCurrentUser()

    const [loading, setLoading] = useState(true)
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState('Standard Operating Procedure')
    const [groupId, setGroupId] = useState('')
    const [bodyHtml, setBodyHtml] = useState('')
    const [isMandatory, setIsMandatory] = useState(false)
    const [headerImage, setHeaderImage] = useState('')
    const [uploadingHeader, setUploadingHeader] = useState(false)
    const [status, setStatus] = useState({ type: '', msg: '' })

    // Image Cropping State
    const [tempImage, setTempImage] = useState<string | null>(null)
    const [isCropperOpen, setIsCropperOpen] = useState(false)
    const [originalFileName, setOriginalFileName] = useState('')
    const [groups, setGroups] = useState<any[]>([])
    const [contentData, setContentData] = useState<any>(null)

    const isSuperAdmin = role === Role.SUPER_ADMIN || role === Role.MAINTAINER
    const isGroupLocked = role === Role.SUPERVISOR || role === Role.GROUP_ADMIN

    useEffect(() => {
        async function loadContent() {
            if (!id) return
            const res = await getContentByIdAction(id)
            if (res.success && res.data) {
                const c = res.data
                setContentData(c)
                
                // RBAC Check for Edit
                const canEdit = isSuperAdmin || (role === Role.GROUP_ADMIN && c.group_id === group?.id) || (role === Role.SUPERVISOR && c.group_id === group?.id)
                
                if (!canEdit) {
                    router.push('/dashboard/content')
                    return
                }

                setTitle(c.title)
                setCategory(c.category)
                setGroupId(c.group_id || 'global')
                setBodyHtml(c.body)
                setIsMandatory(c.is_mandatory_read)
                setHeaderImage(c.image_url || '')
            } else {
                setStatus({ type: 'error', msg: res.error || 'Failed to load article' })
            }
            setLoading(false)
        }
        loadContent()
    }, [id, isSuperAdmin, role, group?.id, router])

    useEffect(() => {
        if (organization?.id) {
            getGroupsAction(organization.id).then(res => {
                if (res.success && res.data) setGroups(res.data)
            })
            // Fetch documents for sources
            const groupFilter = !isSuperAdmin ? group?.id : undefined
            fetch(`/api/documents?orgId=${organization.id}${groupFilter ? `&groupId=${groupFilter}` : ''}`)
                .then(res => res.json())
                .then(res => {
                    if (res.success) setDocuments(res.data || [])
                })
        }
    }, [organization?.id, isSuperAdmin, group?.id])

    // Source Selection Modal
    const [isSourceModalOpen, setIsSourceModalOpen] = useState(false)
    const [documents, setDocuments] = useState<any[]>([])
    const [selectedSources, setSelectedSources] = useState<string[]>([])
    const [docSearch, setDocSearch] = useState('')

    const toggleSource = (docId: string) => {
        if (selectedSources.includes(docId)) {
            setSelectedSources(selectedSources.filter(id => id !== docId))
        } else {
            setSelectedSources([...selectedSources, docId])
        }
    }

    const appendSourceToEditor = () => {
        setIsSourceModalOpen(false)
    }

    const handleHeaderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !organization?.id) return

        setOriginalFileName(file.name)
        const reader = new FileReader()
        reader.onload = (event) => {
            setTempImage(event.target?.result as string)
            setIsCropperOpen(true)
        }
        reader.readAsDataURL(file)
        
        // Reset input to allow re-uploading same file
        e.target.value = ''
    }

    const handleCropComplete = async (croppedBlob: Blob) => {
        if (!organization?.id) return

        setUploadingHeader(true)
        setIsCropperOpen(false)
        try {
            console.log('[KB Edit] Compressing header image')
            const base64data = await compressImage(croppedBlob, 1200, 500, 0.8)
            console.log('[KB Edit] Header image compressed, length:', base64data?.length)
            
            if (base64data) {
                setHeaderImage(base64data)
            } else {
                throw new Error('Compression returned empty data')
            }
            
            setUploadingHeader(false)
            setTempImage(null)
        } catch (error) {
            console.error('Header upload failed:', error)
            alert('Gagal mengunggah header image')
            setUploadingHeader(false)
            setTempImage(null)
        }
    }

    const handleRecrop = () => {
        if (headerImage) {
            setTempImage(headerImage)
            setIsCropperOpen(true)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user?.id || !organization?.id || !id) return

        if (!bodyHtml || bodyHtml === '<p></p>') {
            setStatus({ type: 'error', msg: 'Content body cannot be empty.' })
            return
        }

        setStatus({ type: 'loading', msg: 'Updating article...' })

        const res = await updateContentAction(id, {
            title,
            body: bodyHtml,
            category,
            groupId: groupId === 'global' ? 'global' : groupId,
            isMandatory,
            imageUrl: headerImage
        })

        if (res.success) {
            setStatus({ type: 'success', msg: 'Article updated successfully' })
            setTimeout(() => {
                router.push(`/dashboard/content/${id}`)
            }, 1000)
        } else {
            setStatus({ type: 'error', msg: res.error || 'Failed to update article' })
        }
    }

    const filteredDocs = documents.filter(doc =>
        (doc.file_name || '').toLowerCase().includes(docSearch.toLowerCase()) ||
        (doc.ai_title || '').toLowerCase().includes(docSearch.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-navy-400 mb-4" />
                <p className="text-text-500">Loading Article Data...</p>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 text-text-500 hover:text-navy-900 hover:bg-surface-100 rounded-full transition">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold font-display text-navy-900">Edit Knowledge Base Article</h1>
                </div>
            </div>

            <div className="card p-6 md:p-8">
                {isCropperOpen && tempImage && (
                    <ImageCropper
                        image={tempImage}
                        title="Adjust Header Image"
                        onCancel={() => {
                            setIsCropperOpen(false)
                            setTempImage(null)
                        }}
                        onCropComplete={handleCropComplete}
                        aspect={21 / 9}
                    />
                )}
                {status.msg && (
                    <div className={`p-4 rounded-md mb-6 text-sm font-medium ${status.type === 'error' ? 'bg-danger-bg text-danger border border-red-200' :
                        status.type === 'success' ? 'bg-success-bg text-green-700 border border-green-200' :
                            'bg-navy-50 text-navy-700 border border-blue-200'
                        }`}>
                        {status.msg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-8 space-y-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-text-700">Article Title <span className="text-danger">*</span></label>
                                <input
                                    required
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full border-surface-200 border rounded-md p-3 focus:ring-navy-600 focus:border-navy-600 text-lg font-medium"
                                    placeholder="Enter article title..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-text-700">Header Image</label>
                                {headerImage ? (
                                    <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-surface-200 bg-surface-50 group">
                                        <img src={headerImage} alt="Header" className="h-full w-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleRecrop}
                                                className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md"
                                                title="Recrop Image"
                                            >
                                                <Scissors size={20} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setHeaderImage('')}
                                                className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md"
                                                title="Hapus Image"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => document.getElementById('header-input')?.click()}
                                        className="border-2 border-dashed border-surface-200 rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-navy-400 hover:bg-surface-50 transition-all"
                                    >
                                        <div className="p-3 bg-surface-100 text-text-300 rounded-full">
                                            <ImageIcon size={24} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-navy-900">
                                                {uploadingHeader ? 'Uploading...' : 'Upload Header Image'}
                                            </p>
                                            <p className="text-xs text-text-400 mt-0.5">Suggested ratio 21:9 (Example: 1200x500px)</p>
                                        </div>
                                        {uploadingHeader && <Loader2 size={16} className="animate-spin text-navy-600 mt-1" />}
                                    </div>
                                )}
                                <input
                                    id="header-input"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleHeaderUpload}
                                    disabled={uploadingHeader}
                                />
                            </div>

                            <div className="space-y-2 relative">
                                <label className="flex items-center justify-between text-sm font-medium text-text-700 mb-1">
                                    <span>Content Body <span className="text-danger">*</span></span>
                                </label>

                                <TiptapEditor
                                    content={bodyHtml}
                                    onChange={setBodyHtml}
                                    onOpenSources={() => setIsSourceModalOpen(true)}
                                    orgId={organization?.id}
                                />

                                {selectedSources.length > 0 && (
                                    <div className="mt-2 text-sm text-text-500 flex items-center gap-2">
                                        <BookOpen size={14} className="text-navy-600" />
                                        <span>{selectedSources.length} source document(s) linked.</span>
                                        <button type="button" onClick={() => setIsSourceModalOpen(true)} className="text-navy-600 hover:underline">Manage</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-4 space-y-6">
                            <div className="bg-surface-50 border border-surface-200 p-5 rounded-lg space-y-6">
                                <h3 className="font-bold text-navy-900 font-display pb-3 border-b border-surface-200">Metadata / Attributes</h3>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-text-700">Group / Target Audience <span className="text-danger">*</span></label>
                                    <select
                                        required
                                        value={groupId}
                                        onChange={(e) => setGroupId(e.target.value)}
                                        disabled={isGroupLocked}
                                        className={`w-full border-surface-200 border rounded-md p-2.5 focus:ring-navy-600 focus:border-navy-600 bg-white ${isGroupLocked ? 'opacity-60 cursor-not-allowed bg-surface-50' : ''}`}
                                    >
                                        <option value="" disabled>Select Group...</option>
                                        {isSuperAdmin && (
                                            <option value="global" className="font-bold">🌐 Global Organization (All)</option>
                                        )}
                                        {groups.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                    {isGroupLocked && (
                                        <p className="text-xs text-text-400">
                                            🔒 Group restricted.
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-text-700">Category / Type <span className="text-danger">*</span></label>
                                    <select
                                        required
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full border-surface-200 border rounded-md p-2.5 focus:ring-navy-600 focus:border-navy-600 bg-white"
                                    >
                                        <option value="Standard Operating Procedure">Standard Operating Procedure</option>
                                        <option value="Policy & Guidelines">Policy & Guidelines</option>
                                        <option value="Training Material">Training Material</option>
                                        <option value="Technical Manual">Technical Manual</option>
                                        <option value="Company Announcement">Company Announcement</option>
                                    </select>
                                </div>

                                <div className="space-y-2 pt-2 pb-2">
                                    <label className="flex items-start gap-3 cursor-pointer p-3 bg-white border border-surface-200 rounded-md hover:border-navy-400 transition">
                                        <div className="flex h-5 items-center">
                                            <input
                                                type="checkbox"
                                                checked={isMandatory}
                                                onChange={(e) => setIsMandatory(e.target.checked)}
                                                className="rounded border-surface-300 text-navy-600 focus:ring-navy-600 w-4 h-4"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-navy-900 block">Mandatory Read</span>
                                            <p className="text-xs text-text-500 mt-0.5 leading-snug">
                                                Requires confirmation.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex justify-end gap-3 border-t">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-2.5 border border-surface-200 text-text-700 rounded-md hover:bg-surface-50 font-medium transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={status.type === 'loading'}
                            className="btn btn-primary shadow-md hover:-translate-y-0.5"
                        >
                            <Save size={18} />
                            {status.type === 'loading' ? 'Saving...' : 'Update Article'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Source Modal */}
            {isSourceModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between p-5 border-b border-surface-100 bg-surface-50/50 rounded-t-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-navy-100 text-navy-700 rounded-lg">
                                    <BookOpen size={20} />
                                </div>
                                <h2 className="text-xl font-bold font-display text-navy-900">Link Source Documents</h2>
                            </div>
                            <button onClick={() => setIsSourceModalOpen(false)} className="text-text-400 hover:text-text-700 bg-surface-100 hover:bg-surface-200 rounded p-1 transition">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search repository..."
                                    value={docSearch}
                                    onChange={e => setDocSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-surface-50 border border-surface-200 rounded-md focus:ring-navy-600 focus:border-navy-600 focus:bg-white transition"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-surface-50/30">
                            {documents.length === 0 ? (
                                <div className="text-center py-10 text-text-500">No documents found.</div>
                            ) : filteredDocs.length === 0 ? (
                                <div className="text-center py-10 text-text-500">No matches.</div>
                            ) : (
                                filteredDocs.map((doc) => {
                                    const isSelected = selectedSources.includes(doc.id)
                                    return (
                                        <div
                                            key={doc.id}
                                            onClick={() => toggleSource(doc.id)}
                                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                                                ? 'border-navy-600 bg-navy-50/50 shadow-sm'
                                                : 'border-surface-200 bg-white hover:border-navy-300'
                                                }`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className={`mt-0.5 rounded-full w-5 h-5 flex items-center justify-center border ${isSelected ? 'bg-navy-600 border-navy-600 text-white' : 'border-surface-300'}`}>
                                                    {isSelected && <CheckCircle2 size={14} />}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-navy-900 flex items-center gap-2">
                                                        {doc.ai_title || doc.file_name}
                                                    </h3>
                                                    <div className="mt-2.5 flex gap-2">
                                                        {doc.group?.name && (
                                                            <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded bg-surface-100 text-text-600">
                                                                {doc.group.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        <div className="p-5 border-t bg-white rounded-b-xl flex justify-between items-center">
                            <div className="text-sm text-text-500">
                                {selectedSources.length} selected
                            </div>
                            <button
                                type="button"
                                onClick={appendSourceToEditor}
                                className="btn btn-primary"
                            >
                                Confirm Selection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
