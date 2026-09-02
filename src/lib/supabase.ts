import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
// QA shares Dev's Supabase project but lives in its own Postgres schema, so it needs no separate
// project URL/key — just a schema override. Unset (Dev, Prod) defaults to 'public'.
const SUPABASE_SCHEMA = (import.meta.env.VITE_SUPABASE_SCHEMA as string) || 'public';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: SUPABASE_SCHEMA },
});
