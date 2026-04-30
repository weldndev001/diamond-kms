import { useLanguageStore } from '@/stores/useLanguageStore'
import { translations } from '@/lib/i18n/translations'

export const useTranslation = () => {
    const { language } = useLanguageStore()
    
    const t = (key: string, options?: Record<string, string> | string) => {
        const keys = key.split('.')
        let result: any = translations[language]
        
        const variables = typeof options === 'object' ? options : undefined;
        const defaultValue = typeof options === 'string' ? options : undefined;

        for (const k of keys) {
            if (result && result[k]) {
                result = result[k]
            } else {
                // Fallback to English if key is missing in the current language
                let fallback: any = translations['en']
                for (const fk of keys) {
                    if (fallback && fallback[fk]) {
                        fallback = fallback[fk]
                    } else {
                        return defaultValue || key // Return the default value if provided, or the key itself
                    }
                }
                result = fallback
                break
            }
        }
        
        if (typeof result === 'string' && variables) {
            Object.entries(variables).forEach(([name, value]) => {
                result = result.replace(new RegExp(`{{${name}}}`, 'g'), value)
            })
        }
        
        return result
    }
    
    return { t, language }
}
