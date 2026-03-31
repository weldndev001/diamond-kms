import prisma from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
    let org = null
    try {
        // Get organizations and pick the one that is likely the main one (not Test Org)
        const orgs = await prisma.organization.findMany({
            include: { _count: { select: { users: true } } },
            orderBy: { users: { _count: 'desc' } }
        })
        
        // Pick the one with most users, or fallback to first one that isn't Sample/Test
        org = orgs.find(o => o.name !== 'Test Org' && o.name !== 'Acme IT Solutions') || orgs[0] || null
    } catch (e) {
        console.error('Prisma error in AuthLayout (likely missing columns):', e)
        // Fallback to null to use defaults below
    }

    const appName = org?.app_name || 'DIAMOND KMS'
    const slogan = org?.slogan || 'AI POWERED KNOWLEDGE MANAGEMENT SYSTEM'

    return (
        <div className="min-h-screen bg-surface-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md fade-in">
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2">
                        {org?.logo_url ? (
                            <img 
                                src={org.logo_url.startsWith('http') ? org.logo_url : `/${org.logo_url}`} 
                                alt="Logo" 
                                className="w-8 h-8 object-contain shrink-0" 
                            />
                        ) : (
                            <span className="text-amber-500 text-[18px] leading-none">◆</span>
                        )}
                        <span className="font-display text-[18px] font-extrabold text-navy-900">
                            {appName}
                        </span>
                    </div>
                    <div className="text-[10px] text-text-400 mt-1 font-bold tracking-[0.05em] uppercase text-center w-full max-w-[280px] break-words">
                        {slogan}
                    </div>
                    {org?.name && (
                        <div className="text-[11px] text-text-400 mt-3 font-medium truncate border-t border-surface-200 pt-3 w-full text-center max-w-[180px]">
                            {org.name}
                        </div>
                    )}
                </div>
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
