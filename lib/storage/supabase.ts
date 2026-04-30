import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ Supabase credentials are missing. Storage will not work.')
}

// Create a Supabase client with the service role key to bypass RLS for server-side operations
export const supabase = createClient(
    env.SUPABASE_URL || '',
    env.SUPABASE_SERVICE_ROLE_KEY || '',
    {
        auth: {
            persistSession: false,
        }
    }
)

export const STORAGE_BUCKET = env.SUPABASE_BUCKET || 'documents'
