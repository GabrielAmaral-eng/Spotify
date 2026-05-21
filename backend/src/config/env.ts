import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.string().url().default('http://localhost:8100'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  SPOTIFY_REDIRECT_URI: z
    .string()
    .url()
    .default('http://127.0.0.1:3000/spotify/auth/callback'),
  SPOTIFY_OAUTH_STATE_SECRET: z.string().min(32),
  SPOTIFY_TOKEN_ENCRYPTION_KEY: z.string().min(32)
});

export const env = envSchema.parse(process.env);
