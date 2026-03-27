import { createClient } from '@supabase/supabase-js'

// In the browser, Next.js inlines `NEXT_PUBLIC_*` at build/dev start.
// If env vars are missing (or contain unexpected whitespace), `createClient()`
// throws during module evaluation and breaks `next dev`.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigured =
  !!supabaseUrl && /^https?:\/\//i.test(supabaseUrl) && !!supabaseAnonKey

// Use safe placeholders so the app can still boot on localhost.
// If configuration is wrong, requests will fail, but the dev server won't crash.
export const supabase = createClient(
  supabaseConfigured ? supabaseUrl! : 'http://localhost:54321',
  supabaseConfigured ? supabaseAnonKey! : 'public-anon-key',
)