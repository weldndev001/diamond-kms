import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'en' | 'id'

interface LanguageState {
    language: Language
    setLanguage: (language: Language) => void
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            language: 'id', // Default to Bahasa Indonesia
            setLanguage: (language) => set({ language }),
        }),
        {
            name: 'diamond-kms-language',
        }
    )
)
