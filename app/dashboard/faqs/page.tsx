'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getFAQsAction, createFAQAction, deleteFAQAction } from '@/lib/actions/faq.actions'
import { getGroupsAction } from '@/lib/actions/user.actions'
import { HelpCircle, Plus, Trash2, Search, ChevronDown, ChevronUp, Edit2, Image as ImageIcon, X } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { uploadFileAction } from '@/lib/actions/storage.actions'
import { updateFAQAction } from '@/lib/actions/faq.actions'
import Cropper from 'react-easy-crop'
import { getCroppedImg } from '@/lib/utils/image'

export default function FAQsPage() {
    const { organization, user, role } = useCurrentUser()
    const { t } = useTranslation()

    const [faqs, setFaqs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isEditMode, setIsEditMode] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)
    
    // Helper to make URLs dynamic/relative
    const normalizeUrl = (url?: string) => {
        if (!url) return ''
        if (url.startsWith('data:')) return url // Hande base64 DB storage
        if (url.startsWith('blob:')) return url // Handle local previews
        if (url.startsWith('http://') || url.startsWith('https://')) return url
        
        // If it's an absolute internal storage URL, keep only the relative part
        if (url.includes('/api/storage/')) {
            return url.substring(url.indexOf('/api/storage/'))
        }
        
        // Fallback for older data that might just be "faqs/filename.jpg" or "filename.jpg"
        if (!url.startsWith('/')) {
            return url.includes('/') ? `/api/storage/${url}` : `/api/storage/faqs/${url}`
        }
        
        return url
    }

    const [formData, setFormData] = useState({ 
        question: '', 
        answer: '',
        image_url: ''
    })
    const [localPreview, setLocalPreview] = useState<string | null>(null)

    // Cropping States
    const [imageToCrop, setImageToCrop] = useState<string | null>(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
    const [isCropping, setIsCropping] = useState(false)
    const [originalFileName, setOriginalFileName] = useState('')

    // Accordion state
    const [openIndex, setOpenIndex] = useState<string | null>(null)

    const MAX_FAQS = 20
    const isFull = faqs.length >= MAX_FAQS

    const loadData = async () => {
        if (!organization?.id) return
        setLoading(true)

        const res = await getFAQsAction(organization.id)
        if (res.success) setFaqs(res.data || [])
        
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [organization?.id])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !organization) return

        // 🛡️ Validation: File Size (Max 2MB)
        const MAX_SIZE = 2 * 1024 * 1024
        if (file.size > MAX_SIZE) {
            alert(t('faq.image_too_large'))
            e.target.value = ''
            return
        }

        // 🛡️ Validation: File Type (MIME & Extension)
        const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
        const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp']
        const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
        
        if (!ALLOWED_MIME.includes(file.type.toLowerCase()) && !ALLOWED_EXT.includes(fileExt)) {
            alert(t('faq.invalid_file_type'))
            e.target.value = ''
            return
        }

        setOriginalFileName(file.name)

        // Instead of uploading, read as Data URL to show cropper
        const reader = new FileReader()
        reader.onload = () => {
            setImageToCrop(reader.result as string)
            setIsCropping(true)
        }
        reader.readAsDataURL(file)
    }

    const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }

    const handleSaveCrop = async () => {
        if (!imageToCrop || !croppedAreaPixels || !organization) return
        
        setSaving(true)
        setIsCropping(false)
        setUploadingImage(true)

        try {
            const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels)
            if (!croppedBlob) throw new Error('Failed to crop image')

            // Create preview from blob
            const croppedUrl = URL.createObjectURL(croppedBlob)
            setLocalPreview(croppedUrl)

            // Convert to base64 Data URL instead of uploading to local storage
            // This ensures it works perfectly on Vercel's ephemeral filesystem
            const reader = new FileReader()
            reader.readAsDataURL(croppedBlob)
            reader.onloadend = () => {
                const base64data = reader.result as string
                setFormData(prev => ({ ...prev, image_url: base64data }))
                setSaving(false)
                setUploadingImage(false)
                setImageToCrop(null)
            }
        } catch (err) {
            console.error('Crop/Upload error:', err)
            alert(t('common.error'))
            setLocalPreview(null)
            setSaving(false)
            setUploadingImage(false)
            setImageToCrop(null)
        }
    }

    const openCreateModal = () => {
        setIsEditMode(false)
        setEditingId(null)
        setFormData({ question: '', answer: '', image_url: '' })
        setLocalPreview(null)
        setIsModalOpen(true)
    }

    const openEditModal = (faq: any) => {
        setIsEditMode(true)
        setEditingId(faq.id)
        setFormData({ 
            question: faq.question, 
            answer: faq.answer,
            image_url: faq.image_url || ''
        })
        setLocalPreview(null)
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !organization) return
        
        if (!isEditMode && isFull) {
            alert(t('faq.limit_full'))
            return
        }
        
        setSaving(true)

        let res;
        if (isEditMode && editingId) {
            res = await updateFAQAction(editingId, {
                question: formData.question,
                answer: formData.answer,
                imageUrl: formData.image_url
            })
        } else {
            res = await createFAQAction({
                question: formData.question,
                answer: formData.answer,
                orgId: organization.id,
                userId: user.id,
                imageUrl: formData.image_url
            })
        }

        if (res.success) {
            setIsModalOpen(false)
            setFormData({ question: '', answer: '', image_url: '' })
            setLocalPreview(null)
            loadData()
        } else {
            alert(res.error || t('faq.error'))
        }
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm(t('faq.delete_confirm'))) return
        const res = await deleteFAQAction(id)
        if (res.success) {
            loadData()
        } else {
            alert(res.error || t('common.error'))
        }
    }

    const filteredFaqs = faqs.filter(faq => 
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center banner-primary rounded-3xl p-8 text-white shadow-xl shadow-navy-900/10 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none translate-x-1/4 -translate-y-1/4">
                    <HelpCircle size={200} />
                </div>
                <div className="relative z-10">
                    <h1 className="text-3xl font-black font-display flex items-center gap-3 mb-2 text-white">
                        <HelpCircle size={32} /> {t('faq.title')}
                    </h1>
                    <p className="text-white/80 font-medium max-w-lg leading-relaxed">{t('faq.subtitle')}</p>
                </div>
                {['SUPER_ADMIN', 'MAINTAINER'].includes(role || '') && (
                    <div className="flex flex-col items-end gap-2">
                        <button
                            onClick={() => !isFull && openCreateModal()}
                            disabled={isFull}
                            className={`backdrop-blur-md border border-white/20 px-6 py-3 rounded-2xl font-black font-display shadow-2xl transition-all flex items-center gap-2 relative z-10 active:scale-95 ${isFull 
                                ? 'bg-white/5 text-white/40 cursor-not-allowed border-white/10' 
                                : 'bg-white/20 text-white hover:bg-white/30'}`}
                        >
                            <Plus size={20} /> {t('faq.add_faq')}
                        </button>
                        {isFull && (
                            <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest animate-pulse">
                                {t('faq.limit_full')}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-12 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-navy-500/20 border-t-navy-500 rounded-full animate-spin"></div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t('faq.loading')}</p>
                </div>
            ) : filteredFaqs.length === 0 ? (
                <div className="text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] py-16 text-slate-400">
                    <HelpCircle size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                    <p className="font-bold">{t('faq.no_faqs')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('faq.global_knowledge')}</span>
                        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
                    </div>
                    
                    <div className="space-y-3">
                        {filteredFaqs.map((faq) => (
                            <div key={faq.id} className="group bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-navy-900/5 dark:hover:shadow-indigo-500/5">
                                <div className="flex">
                                    <button
                                        onClick={() => setOpenIndex(openIndex === faq.id ? null : faq.id)}
                                        className="flex-1 px-7 py-5 flex justify-between items-center text-left"
                                    >
                                        <span className="font-extrabold text-slate-900 dark:text-slate-100 pr-4 leading-tight group-hover:text-navy-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {faq.question}
                                        </span>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${openIndex === faq.id ? 'bg-navy-600 text-white rotate-180' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                            <ChevronDown size={18} />
                                        </div>
                                    </button>

                                    {['SUPER_ADMIN', 'MAINTAINER'].includes(role || '') && (
                                        <div className="pr-4 py-4 flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => openEditModal(faq)}
                                                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-navy-600 hover:bg-navy-600/10 rounded-xl transition-all"
                                                title={t('common.edit')}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(faq.id)}
                                                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                title={t('common.delete')}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {openIndex === faq.id && (
                                    <div className="px-7 pb-6 pt-0 animate-in slide-in-from-top-2 duration-300">
                                        <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-4">
                                            {faq.image_url && faq.image_url.trim() !== '' && (
                                                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 max-w-lg shadow-sm">
                                                    <img 
                                                        src={normalizeUrl(faq.image_url)} 
                                                        alt={faq.question} 
                                                        className="w-full h-auto object-cover max-h-[300px]"
                                                        onError={(e) => {
                                                            console.error('Image load error:', faq.image_url);
                                                            // Instead of hiding it completely which confuses users,
                                                            // show a broken image state
                                                            const target = e.target as HTMLImageElement;
                                                            target.style.opacity = '0.3';
                                                            target.title = 'Image not found or missing from local storage';
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap font-medium">
                                                {faq.answer}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        <div className="p-7 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-black font-display flex items-center gap-3 text-slate-900 dark:text-white">
                                <div className="w-10 h-10 rounded-xl bg-navy-50 dark:bg-indigo-900/30 flex items-center justify-center text-navy-600 dark:text-indigo-400">
                                    {isEditMode ? <Edit2 size={20} /> : <Plus size={20} />}
                                </div>
                                {isEditMode ? t('faq.edit_faq') : t('faq.add_new_faq')}
                            </h2>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                {faqs.length} / {MAX_FAQS}
                            </span>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.15em] ml-1">{t('faq.question')}</label>
                                <input
                                    required
                                    autoFocus
                                    type="text"
                                    value={formData.question}
                                    onChange={e => setFormData({ ...formData, question: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-navy-500 dark:text-white font-bold"
                                    placeholder={t('faq.question_placeholder')}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.15em] ml-1">{t('faq.answer')}</label>
                                <textarea
                                    required
                                    value={formData.answer}
                                    onChange={e => setFormData({ ...formData, answer: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 min-h-[120px] focus:ring-2 focus:ring-navy-500 dark:text-white font-medium text-sm leading-relaxed"
                                    placeholder={t('faq.answer_placeholder')}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.15em] ml-1">{t('faq.image')}</label>
                                <div className="space-y-3">
                                    {(formData.image_url || localPreview) ? (
                                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 group">
                                            <img 
                                                src={normalizeUrl(localPreview || formData.image_url)} 
                                                alt="Preview" 
                                                className={`w-full h-48 object-cover transition-opacity ${uploadingImage ? 'opacity-50' : 'opacity-100'}`} 
                                            />
                                            {uploadingImage && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                    <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                </div>
                                            )}
                                            <button 
                                                type="button"
                                                disabled={uploadingImage}
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, image_url: '' }))
                                                    setLocalPreview(null)
                                                }}
                                                className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm opacity-100 hover:bg-black/70 transition-all disabled:opacity-30"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                            <div className="flex flex-col items-center justify-center pt-2 pb-2">
                                                <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                    {uploadingImage ? t('common.loading') : t('faq.upload_image')}
                                                </p>
                                            </div>
                                            <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} disabled={uploadingImage} />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">{t('common.cancel')}</button>
                                <button 
                                    type="submit" 
                                    disabled={saving || (!isEditMode && isFull)} 
                                    className="px-8 py-3 bg-navy-600 hover:bg-navy-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-navy-600/20 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {saving ? t('faq.saving') : t('faq.save_faq')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {isCropping && imageToCrop && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60] flex flex-col animate-in fade-in duration-300">
                    <div className="flex-1 relative">
                        <Cropper
                            image={imageToCrop}
                            crop={crop}
                            zoom={zoom}
                            aspect={16 / 9}
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                        />
                    </div>
                    <div className="p-8 bg-slate-900 border-t border-white/10 flex flex-col gap-6">
                        <div className="flex items-center gap-6 max-w-xl mx-auto w-full">
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest shrink-0">Zoom</span>
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                aria-labelledby="Zoom"
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="flex-1 accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="flex justify-center gap-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCropping(false)
                                    setImageToCrop(null)
                                }}
                                className="px-8 py-3 text-white/60 font-black text-xs uppercase tracking-[0.2em] hover:text-white transition-all"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveCrop}
                                className="px-10 py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-indigo-500/20 active:scale-95 transition-all"
                            >
                                {t('faq.save_crop')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
