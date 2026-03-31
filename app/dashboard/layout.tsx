'use client'

import { useCurrentUser, UserProvider } from '@/hooks/useCurrentUser'
import { ReactNode, useState, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
    Home, FileText, Tags, Bot, Award, FileQuestion, Users,
    Network, CreditCard, Activity,
    Shield, FolderTree, Settings, Menu, Sparkles, Wrench, Search, X,
    ChevronDown, ChevronRight, PanelLeftOpen, PanelLeftClose,
    KeyRound, Building, MonitorDot, Globe
} from 'lucide-react'
import { NotificationBell } from '@/components/shared/NotificationBell'
import SmartSearch from '@/components/search/SmartSearch'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { useTranslation } from '@/hooks/useTranslation'

import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"

// Icon mapping function
const getIconForLabel = (label: string) => {
    switch (label) {
        case 'Dashboard': return <Home size={16} />
        case 'FAQ':
        case 'FAQs / Help': return <Bot size={16} />
        case 'Manage Knowledge Base':
        case 'Kelola Knowledge Base':
        case 'Cari & Tanya AI':
        case 'Search & Ask AI':
        case 'AI Assistant': return <Sparkles size={16} />
        case 'Knowledge Base': return <Tags size={16} />
        case 'Content':
        case 'Manage Content':
        case 'Kelola Konten':
        case 'Dokumen':
        case 'Manage Document':
        case 'Documents': return <FileText size={16} />
        case 'Quizzes':
        case 'Quiz':
        case 'Pemahaman Pegawai': return <FileQuestion size={16} />
        case 'User':
        case 'Users':
        case 'Anggota': return <Users size={16} />
        case 'Organization Settings':
        case 'Organization': return <Settings size={16} />
        case 'OTP':
        case 'Activation': return <KeyRound size={16} />
        case 'Remote Access':
        case 'Akses Remote': return <MonitorDot size={16} />
        case 'Divisions':
        case 'Division':
        case 'Divisi': return <Network size={16} />
        case 'Leaderboard': return <Award size={16} />
        case 'Group':
        case 'Divisions': return <Network size={16} />
        case 'Billing': return <CreditCard size={16} />
        case 'AI Management': return <Sparkles size={16} />
        case 'System Overview': return <Shield size={16} />
        case 'Organizations': return <FolderTree size={16} />
        case 'Logs': return <Activity size={16} />
        case 'Application':
        case 'Website':
        case 'Website & System': return <Globe size={16} />
        default: return <FileText size={16} />
    }
}

interface NavItem {
    label: string
    href: string
}

interface NavGroup {
    label: string
    icon: string
    children: NavItem[]
}

type NavEntry = NavItem | NavGroup

function isNavGroup(entry: NavEntry): entry is NavGroup {
    return 'children' in entry
}

// Nav structure per role
const getNavEntries = (role: string | undefined, t: (key: string) => string): NavEntry[] => {
    const base: NavEntry[] = [
        { label: t('common.dashboard'), href: '/dashboard' },
        { label: t('common.faq'), href: '/dashboard/faqs' },
        { label: t('common.ai_assistant'), href: '/dashboard/ai-assistant' },
        {
            label: t('common.knowledge_management'),
            icon: 'Tags',
            children: [
                { label: t('common.manage_knowledge_base'), href: '/dashboard/knowledge-base' },
                { label: t('common.manage_document'), href: '/dashboard/documents' },
                { label: t('common.manage_content'), href: '/dashboard/content' }
            ]
        },
        {
            label: t('common.quiz_management'),
            icon: 'FileQuestion',
            children: [
                { label: t('common.quiz'), href: '/dashboard/quizzes' },
                { label: t('common.leaderboard'), href: '/dashboard/quizzes?view=leaderboard' },
            ]
        },
    ]

    if (role === 'SUPER_ADMIN') {
        return [
            ...base,
            {
                label: t('common.user_management'),
                icon: 'Users',
                children: [
                    { label: t('common.members'), href: '/dashboard/hrd/users' },
                    { label: t('common.divisions'), href: '/dashboard/hrd/users/divisions' },
                ]
            },
            // Divisions removed as it's now in the User accordion
            {
                label: t('common.settings'),
                icon: 'Settings',
                children: [
                    { label: t('common.billing'), href: '/dashboard/hrd/billing' },
                    { label: t('common.ai_management'), href: '/dashboard/hrd/ai' },
                    { label: t('common.maintenance'), href: '/dashboard/hrd/maintenance' },
                    { label: t('common.activation'), href: '/dashboard/hrd/otp' },
                    { label: t('common.application'), href: '/dashboard/hrd/website' },
                ],
            },
        ]
    }

    if (role === 'GROUP_ADMIN') {
        return [
            ...base,
            {
                label: t('common.members'),
                icon: 'Users',
                children: [
                    { label: t('common.members'), href: '/dashboard/hrd/users' },
                    { label: t('common.divisions'), href: '/dashboard/hrd/users/divisions' },
                ]
            },
        ]
    }

    if (role === 'SUPERVISOR') {
        return [
            ...base,
        ]
    }

    if (role === 'MAINTAINER') {
        return [
            { label: t('common.system_overview'), href: '/dashboard/maintenance' },
            { label: t('common.organizations'), href: '/dashboard/maintenance/organizations' },
            { label: t('common.ai_providers'), href: '/dashboard/maintenance/ai-providers' },
            { label: t('common.monitoring'), href: '/admin/monitoring' },
            { label: t('common.logs'), href: '/dashboard/maintenance/logs' },
        ]
    }

    return base
}

/* ── Accordion sidebar group ── */
function SidebarGroup({ group, pathname, searchParams }: { group: NavGroup; pathname: string; searchParams: URLSearchParams }) {
    const checkIsActive = (href: string) => {
        const [path, query] = href.split('?')
        if (query) {
            return pathname === path && searchParams.toString().includes(query)
        }
        return pathname === path && !searchParams.toString()
    }

    const hasActiveChild = group.children.some(c => checkIsActive(c.href))
    const [open, setOpen] = useState(hasActiveChild)

    return (
        <div>
            <button
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${hasActiveChild
                        ? 'bg-navy-600/30 text-white'
                        : 'text-surface-300 hover:text-white hover:bg-white/5'
                    }`}
            >
                <span className="flex items-center gap-2">
                    <span className={hasActiveChild ? 'text-navy-400' : 'text-white/80'}>
                        {getIconForLabel(group.label)}
                    </span>
                    <span className="text-white">{group.label}</span>
                </span>
                <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''} text-white`}
                />
            </button>

            {/* Sub-items */}
            <div className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-[300px] mt-1' : 'max-h-0'}`}>
                <div className="pl-4 space-y-0.5">
                    {group.children.map(child => {
                        const isActive = checkIsActive(child.href)
                        return (
                            <Link
                                key={child.href}
                                href={child.href}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isActive
                                        ? 'bg-navy-600/20'
                                        : 'hover:bg-white/5'
                                    }`}
                            >
                                <span className={isActive ? 'text-amber-400' : 'text-white'}>
                                    {getIconForLabel(child.label)}
                                </span>
                                <span className="text-white">{child.label}</span>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function DashboardLayoutInner({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const { user, role, organization, isLoading } = useCurrentUser()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login')
        }
    }, [isLoading, user, router])

    const { t } = useTranslation()

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin"></div>
                    <p className="text-navy-700 font-medium">{t('common.loading')}</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    const navEntries = getNavEntries(role, t)

    return (
        <div className="flex h-screen bg-surface-50 overflow-hidden relative">
            {/* Sidebar */}
            <aside
                className={`bg-navy-sidebar border-r border-white/5 flex flex-col hidden md:flex shrink-0 transition-all duration-300 ease-in-out overflow-hidden shadow-2xl z-20 ${isSidebarOpen ? 'w-[280px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
                    }`}
            >
                {/* Brand Logo */}
                <div className="p-[24px_20px]">
                    <div className="font-display text-[18px] font-extrabold text-white flex items-center gap-2">
                        {organization?.logo_url ? (
                            <img 
                                src={organization.logo_url.startsWith('http') ? organization.logo_url : `/${organization.logo_url}`} 
                                alt="Logo" 
                                className="w-8 h-8 object-contain shrink-0" 
                            />
                        ) : (
                            <span className="text-amber-400 text-[16px] leading-none">◆</span>
                        )}
                        <span className="truncate">
                            {organization?.app_name || 'DIAMOND'}
                        </span>
                    </div>
                    <div className="text-[10px] text-sidebar-muted mt-1 font-bold tracking-[0.05em] uppercase truncate">
                        {organization?.slogan || 'KNOWLEDGE MANAGEMENT SYSTEM'}
                    </div>
                    {organization?.name && (
                        <div className="text-[11px] text-sidebar-foreground mt-3 font-medium truncate border-t border-white/10 pt-3">
                            {organization.name}
                        </div>
                    )}
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto scrollbar-thin">
                    {navEntries.map((entry, idx) => {
                        if (isNavGroup(entry)) {
                            return <SidebarGroup key={entry.label} group={entry} pathname={pathname} searchParams={searchParams} />
                        }
                        const item = entry as NavItem
                        const [itemPath, itemQuery] = item.href.split('?')
                        const isActive = itemQuery
                            ? (pathname === itemPath && searchParams.toString().includes(itemQuery))
                            : (pathname === itemPath && !searchParams.toString())

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`relative flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${isActive
                                    ? 'bg-navy-600/30 text-sidebar-foreground shadow-inner shadow-white/10'
                                    : 'text-white hover:text-sidebar-foreground hover:bg-white/5'
                                    }`}
                            >
                                {isActive && (
                                    <div className="absolute left-0 w-1 h-6 bg-navy-400 rounded-r-full shadow-[0_0_10px_rgba(96,165,250,0.5)]" />
                                )}
                                <span className={isActive ? 'text-navy-400' : 'text-white/80'}>
                                    {getIconForLabel(item.label)}
                                </span>
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                {/* Bottom User Area */}
                <div className="mt-auto p-4 border-t border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-navy-600 to-navy-400 flex items-center justify-center text-white font-bold font-display text-xs shrink-0 shadow-md">
                            {(user.full_name || 'User').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-sidebar-foreground truncate">
                                {user.full_name}
                            </div>
                            <div className="text-[11px] text-sidebar-muted truncate">
                                {role?.replace('_', ' ')}
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Topbar */}
                <header className="h-[60px] bg-surface-0 border-b border-surface-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                        {/* Sidebar Toggle */}
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                             className="p-2 text-text-400 hover:text-navy-600 hover:bg-surface-50 rounded-lg transition-all active:scale-95 border border-transparent hover:border-surface-200"
                            title={isSidebarOpen ? t('common.hide_menu') : t('common.show_menu')}
                        >
                            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        </button>

                        <div className="h-6 w-px bg-surface-200 mx-2 hidden sm:block" />

                        <div className="flex flex-col">
                            <div className="font-semibold text-text-900 text-sm">
                                {organization?.name || t('common.workspace')}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-5 items-center">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="p-2 text-text-400 hover:text-navy-600 hover:bg-surface-100 rounded-full transition-colors">
                                    <Search size={20} />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden border-none bg-transparent shadow-none">
                                <div className="bg-white dark:bg-surface-0 rounded-2xl overflow-hidden max-h-[85vh] flex flex-col border dark:border-surface-100">
                                    <div className="p-4 border-b border-surface-100 dark:border-surface-100 flex items-center justify-between bg-surface-50 dark:bg-surface-50">
                                        <div className="flex items-center gap-2 text-text-900 font-bold font-display">
                                            <Search size={18} className="text-amber-500" />
                                            {t('common.smart_search')}
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                                        <SmartSearch />
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <LanguageSwitcher />
                        <ThemeToggle />
                        <NotificationBell userId={user.id} />
                        <Link href="/dashboard/profile" className="flex items-center gap-2 text-sm font-medium text-text-700 hover:text-navy-600 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-600 to-navy-400 flex items-center justify-center text-white font-bold font-display text-[10px] shadow-sm">
                                {(user.full_name || 'User').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="hidden sm:inline-block">{(user.full_name || 'User').split(' ')[0]}</span>
                        </Link>
                    </div>
                </header>

                {/* Page Content area */}
                <main className="flex-1 overflow-auto bg-surface-50 p-6 md:p-8">
                    <div className="max-w-6xl mx-auto fade-in">
                        {children}
                    </div>
                </main>
            </div>


        </div>
    )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <UserProvider>
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-surface-50">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-600 border-t-transparent"></div>
            </div>}>
                <DashboardLayoutInner>{children}</DashboardLayoutInner>
            </Suspense>
        </UserProvider>
    )
}
