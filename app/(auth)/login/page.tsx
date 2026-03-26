'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '@/lib/validations'
import { loginAction } from '@/lib/actions/auth.actions'
import { useForm as hookUseForm } from 'react-hook-form'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)

    const { register, handleSubmit, formState: { errors, /*isSubmitting*/ } } = hookUseForm<LoginFormValues>({
        resolver: zodResolver(loginSchema)
    })

    // Hacky isSubmitting cause of bug
    const [isSubmitting, setIsSubmitting] = useState(false)

    const onSubmit = async (data: LoginFormValues) => {
        setIsSubmitting(true)
        setError(null)

        try {
            const { signIn } = await import('next-auth/react')
            const res = await signIn('credentials', {
                email: data.email,
                password: data.password,
                redirect: false,
            })

            if (res?.error) {
                setError(res.error === 'CredentialsSignin' ? 'Email atau password salah' : res.error)
            } else {
                // Determine redirect based on role (could be more sophisticated)
                router.push('/dashboard')
            }
        } catch (e: any) {
            setError(e.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div>
            <h2 className="text-2xl font-bold font-display mb-6 text-navy-900 font-display">Sign in to your account</h2>

            {error && (
                <div className="bg-danger-bg text-danger p-3 rounded-md mb-5 text-sm font-medium border border-red-200">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                    <label className="block text-[13px] font-semibold text-text-700 mb-1.5">Email address</label>
                    <input
                        {...register('email')}
                        type="email"
                        className="input-field"
                        placeholder="Masukkan email..."
                    />
                    {errors.email && <p className="mt-1.5 text-xs text-danger font-medium">{errors.email.message}</p>}
                </div>

                <div>
                    <label className="block text-[13px] font-semibold text-text-700 mb-1.5">Password</label>
                    <input
                        {...register('password')}
                        type="password"
                        className="input-field"
                        placeholder="••••••••"
                    />
                    {errors.password && <p className="mt-1.5 text-xs text-danger font-medium">{errors.password.message}</p>}
                </div>

                <div className="flex items-center justify-between pt-1">
                    <div className="text-sm">
                        <Link href="/reset-password" className="font-medium text-navy-600 hover:text-navy-700 transition-colors">
                            Forgot your password?
                        </Link>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary w-full justify-center mt-2"
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Wait...
                        </>
                    ) : 'Sign in'}
                </button>
            </form>

        </div>
    )
}
