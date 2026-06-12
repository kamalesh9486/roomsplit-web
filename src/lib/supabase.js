import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isConfigured = !!(
  url && key &&
  url.startsWith('https://') &&
  !url.includes('your-project') &&
  !key.includes('your-anon-key')
)

// Only instantiate when credentials are valid — createClient throws on empty/invalid URL
export const supabase = isConfigured ? createClient(url, key) : null
