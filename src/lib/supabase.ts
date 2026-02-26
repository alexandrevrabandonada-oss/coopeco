import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const createClient = () => {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  const e2eToken =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? window.localStorage.getItem("eco_e2e_access_token")
      : null

  return createSupabaseClient(supabaseUrl!, supabaseAnonKey!, {
    global: e2eToken
      ? {
          headers: {
            Authorization: `Bearer ${e2eToken}`,
          },
        }
      : undefined,
  })
}
