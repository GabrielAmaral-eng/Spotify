import { env } from '../../config/env';
import { supabaseAdminClient } from '../../lib/supabase';
import { HttpError } from '../../utils/http-error';
import {
  createOAuthState,
  decryptRefreshToken,
  encryptRefreshToken,
  readOAuthState
} from './spotify-auth.crypto';
import { spotifyHttp } from './spotify-http';

const spotifyScopes = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state'
];

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

interface SpotifyProfileResponse {
  id: string;
  display_name: string | null;
}

interface SpotifyConnectionRow {
  user_id: string;
  spotify_user_id: string;
  spotify_display_name: string | null;
  encrypted_refresh_token: string;
  scope: string;
}

export interface SpotifyConnectionStatus {
  connected: boolean;
  spotifyUserId?: string;
  displayName?: string;
}

interface CachedAccessToken {
  token: string;
  expiresAt: number;
}

class SpotifyAuthService {
  private readonly cachedAccessTokens = new Map<string, CachedAccessToken>();

  createAuthorizationUrl(userId: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.SPOTIFY_CLIENT_ID,
      scope: spotifyScopes.join(' '),
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
      state: createOAuthState(userId)
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async connectFromCallback(code: string, state: string): Promise<void> {
    const { sub: userId } = readOAuthState(state);
    const tokenResponse = await this.exchangeCodeForTokens(code);
    const profile = await this.fetchProfile(tokenResponse.access_token);
    const existingConnection = await this.getConnectionRow(userId);
    const refreshToken =
      tokenResponse.refresh_token ??
      (existingConnection
        ? decryptRefreshToken(existingConnection.encrypted_refresh_token)
        : null);

    if (!refreshToken) {
      throw new HttpError('Spotify nao retornou um refresh token valido.', 502);
    }

    const { error } = await supabaseAdminClient.from('spotify_connections').upsert(
      {
        user_id: userId,
        spotify_user_id: profile.id,
        spotify_display_name: profile.display_name,
        encrypted_refresh_token: encryptRefreshToken(refreshToken),
        scope: tokenResponse.scope,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: 'user_id'
      }
    );

    if (error) {
      throw error;
    }

    this.cachedAccessTokens.set(userId, {
      token: tokenResponse.access_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000
    });
  }

  async getStatus(userId: string): Promise<SpotifyConnectionStatus> {
    const connection = await this.getConnectionRow(userId);

    if (!connection) {
      return { connected: false };
    }

    return {
      connected: true,
      spotifyUserId: connection.spotify_user_id,
      displayName: connection.spotify_display_name ?? undefined
    };
  }

  async disconnect(userId: string): Promise<void> {
    const { error } = await supabaseAdminClient
      .from('spotify_connections')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    this.cachedAccessTokens.delete(userId);
  }

  async getAccessToken(userId: string): Promise<{ accessToken: string; expiresIn: number }> {
    const cachedToken = this.cachedAccessTokens.get(userId);

    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
      return {
        accessToken: cachedToken.token,
        expiresIn: Math.floor((cachedToken.expiresAt - Date.now()) / 1000)
      };
    }

    const connection = await this.getConnectionRow(userId);

    if (!connection) {
      throw new HttpError('Conta Spotify nao conectada.', 404);
    }

    const tokenResponse = await this.refreshAccessToken(
      decryptRefreshToken(connection.encrypted_refresh_token)
    );
    const refreshToken = tokenResponse.refresh_token;

    if (refreshToken) {
      const { error } = await supabaseAdminClient
        .from('spotify_connections')
        .update({
          encrypted_refresh_token: encryptRefreshToken(refreshToken),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    }

    const expiresAt = Date.now() + tokenResponse.expires_in * 1000;
    this.cachedAccessTokens.set(userId, {
      token: tokenResponse.access_token,
      expiresAt
    });

    return {
      accessToken: tokenResponse.access_token,
      expiresIn: tokenResponse.expires_in
    };
  }

  async playTrack(userId: string, deviceId: string, trackId: string): Promise<void> {
    const { accessToken } = await this.getAccessToken(userId);

    await spotifyHttp.put(
      'https://api.spotify.com/v1/me/player/play',
      {
        uris: [`spotify:track:${trackId}`]
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          device_id: deviceId
        }
      }
    );
  }

  private async getConnectionRow(userId: string): Promise<SpotifyConnectionRow | null> {
    const { data, error } = await supabaseAdminClient
      .from('spotify_connections')
      .select(
        'user_id, spotify_user_id, spotify_display_name, encrypted_refresh_token, scope'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as SpotifyConnectionRow | null) ?? null;
  }

  private async exchangeCodeForTokens(code: string): Promise<SpotifyTokenResponse> {
    return this.requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.SPOTIFY_REDIRECT_URI
    });
  }

  private async refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
    return this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
  }

  private async requestToken(params: Record<string, string>): Promise<SpotifyTokenResponse> {
    const credentials = Buffer.from(
      `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');
    const body = new URLSearchParams(params);

    const { data } = await spotifyHttp.post<SpotifyTokenResponse>(
      'https://accounts.spotify.com/api/token',
      body,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return data;
  }

  private async fetchProfile(accessToken: string): Promise<SpotifyProfileResponse> {
    const { data } = await spotifyHttp.get<SpotifyProfileResponse>('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return data;
  }
}

export const spotifyAuthService = new SpotifyAuthService();
