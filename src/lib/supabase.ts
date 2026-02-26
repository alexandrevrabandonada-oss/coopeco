import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const createClient = () => {
  if (!isSupabaseConfigured) {
    // Allow Next.js prerender/build to import client pages without crashing.
    // Client-side usage should still fail fast with a clear configuration error.
    if (typeof window === 'undefined') {
      return new Proxy(
        {},
        {
          get() {
            throw new Error(
              'Supabase client was accessed on the server without NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
            )
          },
        }
      ) as ReturnType<typeof createSupabaseClient>
    }

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
