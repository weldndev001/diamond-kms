'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getQuizByIdAction, submitQuizResultAction } from '@/lib/actions/quiz.actions'
import { ArrowLeft, Clock, CheckCircle, Send } from 'lucide-react'
import Link from 'next/link'

export default function TakeQuizPage() {
    const params = useParams()
    const router = useRouter()
    const { user } = useCurrentUser()

    const [quiz, setQuiz] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [timeLeft, setTimeLeft] = useState<number | null>(null)

    useEffect(() => {
        if (params.id) {
            getQuizByIdAction(params.id as string).then(res => {
                if (res.success && res.data) {
                    setQuiz(res.data)
                    // Simple timer logic (client-side only for MVP)
                    if (res.data.time_limit_minutes) {
                        setTimeLeft(res.data.time_limit_minutes * 60)
                    }
                } else {
                    setError(res.error || 'Failed to load kuis')
                }
                setLoading(false)
            })
        }
    }, [params.id])

    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0 || result) return

        const tick = setTimeout(() => {
            setTimeLeft(prev => prev! - 1)
        }, 1000)

        if (timeLeft === 1) {
            // Auto-submit when time runs out
            handleSubmit()
        }

        return () => clearTimeout(tick)
    }, [timeLeft, result])

    const handleOptionSelect = (questionId: string, option: string) => {
        if (result) return // prevent changing answers after submit
        setAnswers({ ...answers, [questionId]: option })
    }

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!user || !quiz) return
        setSubmitting(true)

        // Calculate score
        let correctCount = 0
        quiz.questions.forEach((q: any) => {
            if (answers[q.id] === q.correct_answer) {
                correctCount++
            }
        })
        const score = Math.round((correctCount / quiz.questions.length) * 100)

        const res = await submitQuizResultAction({
            quizId: quiz.id,
            userId: user.id,
            score,
            answers
        })

        if (res.success) {
            setResult({ score, correctCount, total: quiz.questions.length })
        } else {
            alert(res.error || 'Failed to submit quiz results.')
        }
        setSubmitting(false)
    }

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s < 10 ? '0' : ''}${s}`
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-32">
            <div className="w-14 h-14 border-4 border-navy-100 border-t-navy-600 rounded-full animate-spin mb-6"></div>
            <p className="text-text-400 font-black uppercase tracking-[0.2em] text-[11px]">Memuat Kuis...</p>
        </div>
    )
    if (error || !quiz) return (
        <div className="max-w-4xl mx-auto p-12 text-center bg-white dark:bg-slate-800 rounded-[40px] border border-surface-200 dark:border-slate-700 shadow-xl mt-10">
            <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Send size={32} className="rotate-45" />
            </div>
            <h2 className="text-2xl font-black text-text-900 dark:text-white mb-2">Kuis Tidak Ditemukan</h2>
            <p className="text-text-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">
                {error || 'Kuis yang Anda cari tidak tersedia atau terjadi kesalahan teknis.'}
            </p>
            <Link href="/dashboard/quizzes" className="btn btn-primary px-8 py-3 rounded-2xl">
                Kembali ke Daftar Kuis
            </Link>
        </div>
    )

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 border-b pb-4">
                <Link href="/dashboard/quizzes" className="p-2 text-text-500 hover:text-navy-900 hover:bg-surface-100 rounded-full transition">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold font-display text-navy-900">{quiz.title}</h1>
                    {quiz.description && <p className="text-text-500 text-sm mt-1">{quiz.description}</p>}
                </div>

                {timeLeft !== null && !result && (
                    <div className={`flex items-center gap-2 px-4 py-2 font-bold font-display rounded-lg ${timeLeft < 60 ? 'bg-danger-bg text-red-700 animate-pulse' : 'bg-surface-100 text-text-700'}`}>
                        <Clock size={18} />
                        {formatTime(timeLeft)}
                    </div>
                )}
            </div>

            {result ? (
                <div className="bg-white p-8 rounded-xl shadow-sm border text-center space-y-4">
                    <div className="w-20 h-20 mx-auto bg-green-100 text-success rounded-full flex items-center justify-center">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-3xl font-bold font-display text-navy-900">Quiz Completed!</h2>
                    <p className="text-lg text-text-500">
                        You scored <span className="font-bold font-display text-navy-600 text-2xl mx-1">{result.score}%</span>
                        ({result.correctCount} out of {result.total} correct)
                    </p>

                    {result.score >= 60 ? (
                        <p className="text-success font-medium bg-success-bg p-3 rounded-lg inline-block">
                            🎉 Excellent! You have been awarded {Math.floor(result.score / 10) * 10} Leaderboard Points.
                        </p>
                    ) : (
                        <p className="text-orange-600 font-medium bg-orange-50 p-3 rounded-lg inline-block">
                            💡 You might want to review the materials and try again later.
                        </p>
                    )}

                    <div className="pt-6 border-t mt-6">
                        <Link href="/dashboard/quizzes" className="inline-block px-6 py-2.5 bg-navy-900 text-white rounded hover:bg-navy-900 transition font-medium">
                            Return to Quizzes
                        </Link>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-8 pb-12">
                    {quiz.questions.map((q: any, i: number) => (
                        <div key={q.id} className="p-8 border border-surface-200 dark:border-slate-700 rounded-[32px] shadow-sm bg-white dark:bg-slate-800/50 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-navy-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            <h3 className="font-bold text-xl text-navy-900 dark:text-white mb-6 tracking-tight leading-relaxed">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-navy-50 dark:bg-navy-900/50 text-navy-600 dark:text-navy-400 text-sm font-black mr-3 border border-navy-100 dark:border-navy-500/20">{i + 1}</span>
                                {q.question_text || "Lihat Gambar di Bawah:"}
                            </h3>

                            {q.image && (
                                <div className="mb-8 flex justify-center">
                                    <div className="relative group/img-container">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-navy-500 to-indigo-500 rounded-2xl blur opacity-20 group-hover/img-container:opacity-30 transition duration-1000"></div>
                                        <img 
                                            src={q.image} 
                                            alt={`Soal ${i + 1}`} 
                                            className="relative max-h-80 w-auto rounded-xl shadow-2xl border border-white dark:border-slate-700 object-contain bg-white dark:bg-slate-900 p-1"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4">
                                {Array.isArray(q.options) && q.options.map((opt: string, optIdx: number) => (
                                    <label
                                        key={optIdx}
                                        className={`flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 group/option ${answers[q.id] === opt
                                            ? 'border-navy-600 bg-navy-50 dark:bg-navy-900/30 text-navy-900 dark:text-navy-100 shadow-[0_0_20px_rgba(30,58,138,0.08)]'
                                            : 'border-surface-100 dark:border-slate-800 hover:border-navy-200 dark:hover:border-navy-800 bg-white dark:bg-slate-900/50 text-text-700 dark:text-slate-300 hover:shadow-md'
                                            }`}
                                    >
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-all ${answers[q.id] === opt
                                            ? 'border-navy-600 bg-navy-600'
                                            : 'border-surface-300 dark:border-slate-600 group-hover/option:border-navy-400'
                                            }`}>
                                            {answers[q.id] === opt && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}
                                        </div>
                                        <input
                                            type="radio"
                                            name={`question-${q.id}`}
                                            value={opt}
                                            checked={answers[q.id] === opt}
                                            required
                                            onChange={() => handleOptionSelect(q.id, opt)}
                                            className="hidden"
                                        />
                                        <span className="font-bold text-base">{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-end pt-8">
                        <button
                            type="submit"
                            disabled={submitting || Object.keys(answers).length < quiz.questions.length}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-navy-900 dark:bg-navy-600 text-white rounded-2xl hover:bg-navy-800 dark:hover:bg-navy-500 transition-all font-black uppercase tracking-widest text-sm shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
                        >
                            {submitting ? 'Submitting...' : (
                                <>
                                    <span>Submit Answers</span>
                                    <Send size={18} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}
        </div>
    )
}
