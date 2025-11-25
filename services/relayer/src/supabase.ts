import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseAdmin: SupabaseClient | null = null

const url = process.env.SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (url && serviceKey) {
  supabaseAdmin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export { supabaseAdmin }