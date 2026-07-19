import { createBrowserClient } from "@supabase/ssr";

/**
 * Klient przeglądarki — wyłącznie URL + anon key.
 * Nigdy nie używaj service_role tutaj.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Brak NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY w .env.local",
    );
  }

  return createBrowserClient(url, anonKey);
}
