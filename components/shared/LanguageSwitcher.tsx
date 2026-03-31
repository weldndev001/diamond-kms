'use client'

import * as React from 'react'
import { Globe } from 'lucide-react'
import { useLanguageStore, Language } from '@/stores/useLanguageStore'

export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguageStore()
    const [mounted, setMounted] = React.useState(false)

    // avoid hydration mismatch
    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return <div className="w-10 h-10" />

    const toggleLanguage = () => {
        const newLang: Language = language === 'en' ? 'id' : 'en'
        setLanguage(newLang)
    }

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 p-2 text-text-400 hover:text-navy-600 hover:bg-surface-100 dark:hover:bg-navy-800 rounded-full transition-all duration-300 relative group overflow-hidden"
            aria-label="Toggle language"
            title={language === 'en' ? 'Switch to Bahasa Indonesia' : 'Switch to English'}
        >
            <div className="flex items-center gap-1.5">
                <Globe size={18} className="text-text-400 group-hover:text-navy-600 transition-colors" />
                <span className="text-xs font-bold font-display uppercase tracking-wider">
                    {language}
                </span>
            </div>

            {/* Subtle glow effect on hover */}
            <span className="absolute inset-0 bg-navy-600/5 dark:bg-amber-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    )
}
