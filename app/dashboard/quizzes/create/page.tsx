'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { createQuizAction, getQuizByIdAction, updateQuizFullAction } from '@/lib/actions/quiz.actions'
import { getDivisionsAction } from '@/lib/actions/user.actions'
import { getContentsAction } from '@/lib/actions/content.actions'
import { Save, ArrowLeft, PlusCircle, Trash, Send, HelpCircle, Clock, Sparkles, Image as ImageIcon, X } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function CreateQuizPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const editId = searchParams.get('edit')
    const { user, organization, role } = useCurrentUser()
    const userRole = role?.toUpperCase() || ''
    const isSupervisor = userRole === 'SUPERVISOR'
    const isKadiv = userRole === 'GROUP_ADMIN' || userRole === 'SUPER_ADMIN'

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [timeLimit, setTimeLimit] = useState<number | ''>('')
    const [divisionId, setDivisionId] = useState('')
    const [contentId, setContentId] = useState('')
    const [isPublished, setIsPublished] = useState(false)
    const [status, setStatus] = useState({ type: '', msg: '' })

    const [divisions, setDivisions] = useState<any[]>([])
    const [contents, setContents] = useState<any[]>([])

    // Manage multiple questions dynamically
    const [questions, setQuestions] = useState<any[]>([
        { question_text: '', options: ['', '', '', ''], correct_answer: '', image: null }
    ])

    useEffect(() => {
        if (organization?.id) {
            getDivisionsAction(organization.id).then(res => {
                if (res.success) setDivisions(res.data || [])
            })
            getContentsAction(organization.id).then(res => {
                if (res.success) setContents(res.data || [])
            })
        }

        if (editId) {
            getQuizByIdAction(editId).then(res => {
                if (res.success && res.data) {
                    const q = res.data
                    setTitle(q.title)
                    setDescription(q.description || '')
                    setTimeLimit(q.time_limit_minutes || '')
                    setDivisionId(q.division_id)
                    setContentId(q.content_id || '')
                    setIsPublished(q.is_published)
                    if (q.questions && q.questions.length > 0) {
                        setQuestions(q.questions.map((quest: any) => {
                            // Mencari index kunci jawaban dengan aman
                            let correctIdx = -1;
                            if (Array.isArray(quest.options)) {
                                correctIdx = quest.options.indexOf(quest.correct_answer);
                            }
                            
                            return {
                                question_text: quest.question_text,
                                options: Array.isArray(quest.options) ? quest.options : ['', '', '', ''],
                                correct_answer: correctIdx !== -1 ? correctIdx.toString() : '',
                                image: quest.image || null
                            };
                        }))
                    }
                } else {
                    setStatus({ type: 'error', msg: res.error || 'Failed to fetch quiz data.' })
                }
            })
        }
    }, [organization?.id, editId])

    const handleAddQuestion = () => {
        setQuestions([...questions, { question_text: '', options: ['', '', '', ''], correct_answer: '', image: null }])
    }

    const handleImageUpload = async (index: number, file: File) => {
        // Placeholder simulation for image upload
        // In real scenario, upload to Supabase Storage and get URL
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            handleQuestionChange(index, 'image', result);
        };
        reader.readAsDataURL(file);
    }

    const handleRemoveQuestion = (index: number) => {
        const newQs = [...questions]
        newQs.splice(index, 1)
        setQuestions(newQs)
    }

    const handleQuestionChange = (index: number, field: string, value: string | string[] | null, optionIndex?: number) => {
        const newQs = [...questions]
        if (field === 'options' && typeof optionIndex === 'number') {
            newQs[index].options[optionIndex] = value as string
        } else if (field === 'correct_answer' || field === 'question_text' || field === 'image') {
            (newQs[index] as any)[field] = value
        }
        setQuestions(newQs)
    }

    const handleSubmit = async (e: React.FormEvent, overridePublish?: boolean) => {
        if (e) e.preventDefault()
        if (!user?.id || !organization?.id) return

        // Validation
        for (let i = 0; i < questions.length; i++) {
            if (!questions[i].question_text.trim()) {
                setStatus({ type: 'error', msg: `Teks pertanyaan ke-${i + 1} tidak boleh kosong.` })
                return
            }
            if (!questions[i].correct_answer) {
                setStatus({ type: 'error', msg: `Pertanyaan ke-${i + 1} harus memiliki kunci jawaban.` })
                return
            }
        }

        setStatus({ type: 'loading', msg: 'Menyimpan kuis...' })

        const rawIsPublished = typeof overridePublish === 'boolean' ? overridePublish : isPublished
        const finalIsPublished = isSupervisor ? false : rawIsPublished

        const quizData = {
            title,
            description,
            time_limit_minutes: timeLimit ? Number(timeLimit) : undefined,
            division_id: divisionId,
            content_id: contentId || undefined,
            organization_id: organization.id,
            created_by: user.id,
            is_published: finalIsPublished,
            questions: questions.map(q => ({
                ...q,
                correct_answer: q.options[parseInt(q.correct_answer)] || ''
            }))
        }

        const res = editId 
            ? await updateQuizFullAction(editId, quizData)
            : await createQuizAction(quizData)

        if (res.success) {
            setStatus({ type: 'success', msg: editId ? 'Kuis berhasil diperbarui' : 'Kuis berhasil dibuat' })
            setTimeout(() => {
                router.push('/dashboard/quizzes')
            }, 1000)
        } else {
            setStatus({ type: 'error', msg: res.error || 'Gagal menyimpan kuis' })
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/quizzes" className="p-2 text-text-500 hover:text-navy-900 dark:hover:text-slate-100 hover:bg-surface-100 dark:hover:bg-slate-800 rounded-full transition">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-2xl font-bold font-display text-navy-900 dark:text-slate-100">{editId ? 'Edit Quiz' : 'Create New Quiz'}</h1>
            </div>

            <div className="card p-6 dark:bg-surface-0 dark:border-surface-100">
                {status.msg && (
                    <div className={`p-4 rounded-md mb-6 text-sm font-medium ${status.type === 'error' ? 'bg-danger-bg text-danger border border-red-200 dark:bg-danger/10 dark:border-danger/20' :
                        status.type === 'success' ? 'bg-success-bg text-green-700 border border-green-200 dark:bg-success/10 dark:border-success/20' :
                            'bg-navy-50 text-navy-700 border border-blue-200 dark:bg-navy-900 dark:text-navy-300 dark:border-navy-800'
                        }`}>
                        {status.msg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* General Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 border rounded-3xl bg-surface-50 dark:bg-slate-800/40 border-surface-200 dark:border-slate-700/50 shadow-inner">
                        <div className="space-y-2 col-span-full">
                            <label className="block text-sm font-bold text-text-700 dark:text-slate-300 ml-1">Quiz Title *</label>
                            <input
                                required
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-700 text-text-900 dark:text-slate-100 rounded-2xl p-3.5 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all font-medium"
                                placeholder="e.g. Employee Security Awareness 2026"
                            />
                        </div>

                        <div className="space-y-2 col-span-full">
                            <label className="block text-sm font-bold text-text-700 dark:text-slate-300 ml-1">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-700 text-text-900 dark:text-slate-100 rounded-2xl p-3.5 min-h-[120px] outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all font-medium"
                                placeholder="Brief summary of the quiz context..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-text-700 dark:text-slate-300 ml-1">Division (Target Audience) *</label>
                            <select
                                required
                                value={divisionId}
                                onChange={(e) => setDivisionId(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-700 text-text-900 dark:text-slate-100 rounded-2xl p-3.5 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all font-bold appearance-none cursor-pointer"
                            >
                                <option value="" disabled>Select Division...</option>
                                {divisions.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-text-700 dark:text-slate-300 ml-1">Linked Article / Material</label>
                            <select
                                value={contentId}
                                onChange={(e) => setContentId(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-700 text-text-900 dark:text-slate-100 rounded-2xl p-3.5 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all font-bold appearance-none cursor-pointer"
                            >
                                <option value="">None (Standalone Quiz)</option>
                                {contents.map(c => (
                                    <option key={c.id} value={c.id}>[{c.category}] {c.title}</option>
                                ))}
                            </select>
                            <p className="text-[11px] text-text-400 font-medium ml-1">Link this quiz to an existing Knowledge Base article.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-text-700 dark:text-slate-300 ml-1">Time Limit (Minutes)</label>
                            <input
                                type="number"
                                min="1"
                                value={timeLimit}
                                onChange={(e) => setTimeLimit(e.target.value ? Number(e.target.value) : '')}
                                className="w-full bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-700 text-text-900 dark:text-slate-100 rounded-2xl p-3.5 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all font-medium"
                                placeholder="e.g. 15 (Leave empty for no limit)"
                            />
                        </div>

                        {isKadiv && (
                            <div className="space-y-2 flex items-center mt-6">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={isPublished}
                                            onChange={(e) => setIsPublished(e.target.checked)}
                                            className="w-5 h-5 rounded-lg border-surface-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 dark:bg-slate-900 transition-all cursor-pointer"
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-text-700 dark:text-slate-300 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">Publish Immediately</span>
                                </label>
                            </div>
                        )}
                    </div>

                     {/* Question Builder */}
                    <div className="space-y-8 pt-4">
                        <div className="flex justify-between items-center border-b border-surface-200 dark:border-slate-700 pb-5">
                            <h2 className="text-2xl font-black font-display text-navy-900 dark:text-slate-100 tracking-tight">Quiz Builder (Penyusunan Soal)</h2>
                        </div>

                        {questions.map((q: any, qIndex: number) => (
                            <div key={qIndex} className="p-8 border border-surface-200 dark:border-slate-700 rounded-[32px] shadow-sm bg-white dark:bg-slate-800/50 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                {questions.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveQuestion(qIndex)}
                                        className="absolute top-6 right-6 p-2 text-text-300 hover:text-danger hover:bg-danger/5 rounded-xl transition"
                                        title="Remove Question"
                                    >
                                        <Trash size={20} />
                                    </button>
                                )}

                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-500/20">Soal {qIndex + 1}</span>
                                        
                                        {/* TOMBOL ADD IMAGE */}
                                        <button 
                                            type="button"
                                            onClick={() => document.getElementById(`file-upload-${qIndex}`)?.click()}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-surface-100 dark:bg-slate-700 hover:bg-surface-200 dark:hover:bg-slate-600 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 rounded-lg transition-all border border-indigo-100 dark:border-indigo-500/10"
                                        >
                                            <ImageIcon size={14} />
                                            {q.image ? 'Ganti Gambar' : 'Add Image'}
                                        </button>

                                        {/* Input File Tersembunyi */}
                                        <input 
                                            id={`file-upload-${qIndex}`}
                                            type="file" 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(qIndex, file);
                                            }}
                                        />
                                    </div>

                                    {/* PREVIEW GAMBAR */}
                                    {q.image && (
                                        <div className="relative w-fit group/img">
                                            <img 
                                                src={q.image} 
                                                alt="Preview Soal" 
                                                className="max-h-40 rounded-xl object-cover border-2 border-surface-100 dark:border-slate-600 shadow-md"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleQuestionChange(qIndex, 'image', null)}
                                                className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 hover:scale-110 transition-all border-2 border-white dark:border-slate-800"
                                                title="Hapus Gambar"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    )}

                                    <input
                                        required
                                        type="text"
                                        value={q.question_text}
                                        onChange={(e) => handleQuestionChange(qIndex, 'question_text', e.target.value)}
                                        className="w-full bg-transparent border-b-2 border-surface-200 dark:border-slate-700 py-3 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-bold text-lg dark:text-slate-100 transition-colors"
                                        placeholder="Tuliskan pertanyaan kuis di sini..."
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                                        {q.options.map((opt: string, optIndex: number) => (
                                            <div key={optIndex} className="relative group/opt">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative flex items-center">
                                                        <input
                                                            type="radio"
                                                            name={`question-${qIndex}-correctAnswer`}
                                                            required
                                                            checked={q.correct_answer === optIndex.toString()}
                                                            onChange={() => handleQuestionChange(qIndex, 'correct_answer', optIndex.toString())}
                                                            className="w-5 h-5 text-indigo-600 border-surface-300 dark:border-slate-600 focus:ring-indigo-500 dark:bg-slate-900 transition-all cursor-pointer"
                                                            disabled={!opt.trim()}
                                                            title="Mark as correct answer"
                                                        />
                                                    </div>
                                                    <input
                                                        required
                                                        type="text"
                                                        value={opt}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value
                                                            handleQuestionChange(qIndex, 'options', newVal, optIndex)
                                                        }}
                                                        className={`w-full rounded-2xl p-3.5 text-sm outline-none transition-all duration-300 border font-bold ${
                                                            q.correct_answer === optIndex.toString()
                                                                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                                                                : 'bg-white dark:bg-slate-900 border-surface-200 dark:border-slate-700 text-text-900 dark:text-slate-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5'
                                                        }`}
                                                        placeholder={`Pilihan Jawaban ${optIndex + 1}`}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-text-400 font-medium flex items-center gap-2 px-1">
                                        <Sparkles size={14} className="text-indigo-500" /> Isi semua pilihan dan tandai "radio button" untuk jawaban yang benar.
                                    </p>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={handleAddQuestion}
                            className="w-full py-4 border-2 border-dashed border-surface-200 dark:border-surface-100 rounded-lg text-text-500 dark:text-text-500 hover:text-navy-600 dark:hover:text-navy-400 hover:border-blue-400 dark:hover:border-navy-600 hover:bg-navy-50 dark:hover:bg-surface-0 transition flex items-center justify-center gap-2 font-medium"
                        >
                            <PlusCircle size={20} /> Add Another Question
                        </button>
                    </div>

                    <div className="pt-8 flex justify-end gap-3 border-t">
                        <Link
                            href="/dashboard/quizzes"
                            className="px-6 py-2.5 border border-surface-200 text-text-700 rounded-md hover:bg-surface-50 font-medium transition"
                        >
                            Cancel
                        </Link>
                        {isKadiv ? (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => handleSubmit(e as any, false)}
                                    disabled={status.type === 'loading'}
                                    className="px-6 py-2.5 border border-navy-600 text-navy-600 rounded-md hover:bg-navy-50 font-medium transition flex items-center gap-2"
                                >
                                    <Save size={18} />
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => handleSubmit(e as any, true)}
                                    disabled={status.type === 'loading'}
                                    className="btn btn-primary"
                                >
                                    <Send size={18} />
                                    Publish
                                </button>
                            </>
                        ) : (
                            <button
                                type="submit"
                                disabled={status.type === 'loading'}
                                className="btn btn-primary"
                            >
                                <Save size={18} />
                                {editId ? 'Update Draft' : 'Save Draft'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}
