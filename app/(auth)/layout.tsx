import prisma from '@/lib/prisma'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
    const org = await prisma.organization.findFirst()
    const appName = org?.app_name || 'DIAMOND KMS'
    const slogan = org?.slogan || 'Enterprise Knowledge Management'

    return (
        <div className="min-h-screen bg-surface-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md fade-in">
                <div className="flex justify-center mb-6">
                    <div className="w-14 h-14 bg-navy-900 rounded-xl flex items-center justify-center shadow-md">
                        <span className="text-amber-400 text-2xl leading-none">◆</span>
                    </div>
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-navy-900 font-display">
                    {appName}
                </h2>
                <p className="mt-2 text-center text-sm text-text-500 max-w">
                    {slogan}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="card p-8 sm:px-10">
                    {children}
                </div>
            </div>

            <div className="mt-8 text-center text-xs text-text-300">
                WELDN_AI. All rights reserved.
            </div>
        </div>
    )
}
