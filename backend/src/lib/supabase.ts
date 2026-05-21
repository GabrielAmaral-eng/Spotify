import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const authOptions = {
  autoRefreshToken: false,
  detectSessionInUrl: false,
  persistSession: false
};

export const supabaseAuthClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: authOptions
  }
);

export const supabaseAdminClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: authOptions
  }
);

export const createSupabaseUserClient = (accessToken: string) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: authOptions,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
