import axios from 'axios';
import { HttpError } from '../utils/http-error';

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

class TokenService {
  private accessToken: string | null = null;
  private expiresAt = 0;
  private refreshTimer: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    await this.refresh();
  }

  async getToken(): Promise<string> {
    const shouldRefresh = !this.accessToken || Date.now() > this.expiresAt - 60_000;

    if (shouldRefresh) {
      await this.refresh();
    }

    if (!this.accessToken) {
      throw new HttpError('Token do Spotify indisponível.', 503);
    }

    return this.accessToken;
  }

  private async refresh(): Promise<void> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new HttpError('Credenciais do Spotify não configuradas.', 500);
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials' });

    const { data } = await axios.post<SpotifyTokenResponse>(
      'https://accounts.spotify.com/api/token',
      body,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;
    this.scheduleRefresh(data.expires_in);
  }

  private scheduleRefresh(expiresInSeconds: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const refreshInMs = Math.max((expiresInSeconds - 300) * 1000, 60_000);
    this.refreshTimer = setTimeout(() => {
      this.refresh().catch((error: unknown) => {
        console.error('Falha ao renovar token do Spotify:', error);
      });
    }, refreshInMs);
    this.refreshTimer.unref();
  }
}

export const tokenService = new TokenService();
