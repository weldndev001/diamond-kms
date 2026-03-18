'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getFAQsAction, createFAQAction, deleteFAQAction } from '@/lib/actions/faq.actions'
import { getDivisionsAction } from '@/lib/actions/user.actions'
import { HelpCircle, Plus, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react'

export default function FAQsPage() {
    const { organization, user, role } = useCurrentUser()

    const [faqs, setFaqs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({ question: '', answer: '' })

    // Accordion state
    const [openIndex, setOpenIndex] = useState<string | null>(null)

    const isFull = faqs.length >= 10

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

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !organization) return
        if (isFull) {
            alert("FAQ Quota Full (Max 10)")
            return
        }
        setSaving(true)

        const res = await createFAQAction({
            question: formData.question,
            answer: formData.answer,
            orgId: organization.id,
            userId: user.id
        })

        if (res.success) {
            setIsModalOpen(false)
            setFormData({ question: '', answer: '' })
            loadData()
        } else {
            alert(res.error || 'Failed to create FAQ')
        }
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this FAQ?')) return
        const res = await deleteFAQAction(id)
        if (res.success) {
            loadData()
        } else {
            alert(res.error || 'Failed to delete')
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
                        <HelpCircle size={32} /> Help Center & FAQs
                    </h1>
                    <p className="text-white/80 font-medium max-w-lg leading-relaxed">Quick answers to frequently asked questions. Find the information you need instantly.</p>
                </div>
                {['SUPER_ADMIN', 'GROUP_ADMIN', 'MAINTAINER'].includes(role || '') && (
                    <div className="flex flex-col items-end gap-2">
                        <button
                            onClick={() => !isFull && setIsModalOpen(true)}
                            disabled={isFull}
                            className={`backdrop-blur-md border border-white/20 px-6 py-3 rounded-2xl font-black font-display shadow-2xl transition-all flex items-center gap-2 relative z-10 active:scale-95 ${isFull 
                                ? 'bg-white/5 text-white/40 cursor-not-allowed border-white/10' 
                                : 'bg-white/20 text-white hover:bg-white/30'}`}
                        >
                            <Plus size={20} /> Add FAQ
                        </button>
                        {isFull && (
                            <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest animate-pulse">
                                FAQ Limit Full (Max 10)
                            </span>
                        )}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-12 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-navy-500/20 border-t-navy-500 rounded-full animate-spin"></div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading FAQs...</p>
                </div>
            ) : filteredFaqs.length === 0 ? (
                <div className="text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] py-16 text-slate-400">
                    <HelpCircle size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                    <p className="font-bold">No FAQs found.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Global Knowledge Base</span>
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

                                    {['SUPER_ADMIN', 'GROUP_ADMIN'].includes(role || '') && (
                                        <div className="pr-4 py-4 flex items-center shrink-0">
                                            <button
                                                onClick={() => handleDelete(faq.id)}
                                                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                title="Delete FAQ"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {openIndex === faq.id && (
                                    <div className="px-7 pb-6 pt-0 animate-in slide-in-from-top-2 duration-300">
                                        <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/50">
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

            {/* Create FAQ Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        <div className="p-7 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-black font-display flex items-center gap-3 text-slate-900 dark:text-white">
                                <div className="w-10 h-10 rounded-xl bg-navy-50 dark:bg-indigo-900/30 flex items-center justify-center text-navy-600 dark:text-indigo-400">
                                    <Plus size={20} />
                                </div>
                                Add New FAQ
                            </h2>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                {faqs.length} / 10
                            </span>
                        </div>
                        <form onSubmit={handleCreate} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Question</label>
                                <input
                                    required
                                    autoFocus
                                    type="text"
                                    value={formData.question}
                                    onChange={e => setFormData({ ...formData, question: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-navy-500 dark:text-white font-bold"
                                    placeholder="What do you want to ask?"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Answer</label>
                                <textarea
                                    required
                                    value={formData.answer}
                                    onChange={e => setFormData({ ...formData, answer: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 min-h-[140px] focus:ring-2 focus:ring-navy-500 dark:text-white font-medium text-sm leading-relaxed"
                                    placeholder="Provide a clear and concise answer..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancel</button>
                                <button 
                                    type="submit" 
                                    disabled={saving || isFull} 
                                    className="px-8 py-3 bg-navy-600 hover:bg-navy-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-navy-600/20 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save FAQ'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
