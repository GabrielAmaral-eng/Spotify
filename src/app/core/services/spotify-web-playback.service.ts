import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { SpotifyService } from './spotify.service';

interface SpotifyPlaybackState {
  duration: number;
  paused: boolean;
  position: number;
}

interface SpotifyPlayerOptions {
  getOAuthToken: (callback: (token: string) => void) => void;
  name: string;
  volume?: number;
}

interface SpotifyPlayer {
  activateElement(): Promise<void>;
  addListener(event: 'ready', callback: (payload: { device_id: string }) => void): boolean;
  addListener(event: 'not_ready', callback: (payload: { device_id: string }) => void): boolean;
  addListener(event: 'player_state_changed', callback: (state: SpotifyPlaybackState | null) => void): boolean;
  addListener(event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', callback: (payload: { message: string }) => void): boolean;
  connect(): Promise<boolean>;
  disconnect(): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  togglePlay(): Promise<void>;
}

interface SpotifySdk {
  Player: new (options: SpotifyPlayerOptions) => SpotifyPlayer;
}

declare global {
  interface Window {
    Spotify?: SpotifySdk;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

@Injectable()
export class SpotifyWebPlaybackService {
  private readonly spotifyService = inject(SpotifyService);
  private readonly stateSubject = new BehaviorSubject<SpotifyPlaybackState | null>(null);
  private player?: SpotifyPlayer;
  private deviceId?: string;
  private sdkPromise?: Promise<void>;
  private connectPromise?: Promise<string>;

  readonly state$ = this.stateSubject.asObservable();

  get currentState(): SpotifyPlaybackState | null {
    return this.stateSubject.value;
  }

  async play(trackId: string): Promise<void> {
    const deviceId = await this.connect();
    await this.player?.activateElement().catch(() => undefined);
    await firstValueFrom(this.spotifyService.playTrack(trackId, deviceId));
  }

  async pause(): Promise<void> {
    await this.player?.pause();
  }

  async resume(): Promise<void> {
    await this.player?.resume();
  }

  async toggle(): Promise<void> {
    await this.player?.togglePlay();
  }

  async seek(positionMs: number): Promise<void> {
    await this.player?.seek(positionMs);
  }

  private async connect(): Promise<string> {
    if (this.deviceId) {
      return this.deviceId;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.createPlayer().catch((error: unknown) => {
        this.resetPlayer();
        throw this.normalizeError(error);
      });
    }

    return this.connectPromise;
  }

  private async createPlayer(): Promise<string> {
    await this.loadSdk();

    if (!window.Spotify) {
      throw new Error('SDK de reproducao indisponivel.');
    }

    const initialAccessToken = await this.getPlaybackAccessToken();
    let connectAccessToken: string | undefined = initialAccessToken;

    this.player?.disconnect();
    this.player = new window.Spotify.Player({
      name: 'Melodix Player',
      volume: 0.8,
      getOAuthToken: (callback) => {
        if (connectAccessToken) {
          callback(connectAccessToken);
          connectAccessToken = undefined;
          return;
        }

        this.getPlaybackAccessToken()
          .then((token) => callback(token))
          .catch((error: unknown) => {
            console.error('Nao foi possivel obter token de playback:', error);
            callback('');
          });
      }
    });

    let timeout: number | undefined;

    const readyPromise = new Promise<string>((resolve, reject) => {
      const fail = (message: string) => {
        if (timeout !== undefined) {
          window.clearTimeout(timeout);
        }

        reject(new Error(message));
      };

      timeout = window.setTimeout(() => {
        fail('Tempo esgotado ao conectar o player.');
      }, 15_000);

      this.player?.addListener('ready', ({ device_id }) => {
        if (timeout !== undefined) {
          window.clearTimeout(timeout);
        }

        this.deviceId = device_id;
        resolve(device_id);
      });

      this.player?.addListener('not_ready', ({ device_id }) => {
        if (this.deviceId === device_id) {
          this.deviceId = undefined;
          this.connectPromise = undefined;
        }
      });

      this.player?.addListener('player_state_changed', (state) => {
        this.stateSubject.next(state);
      });

      this.player?.addListener('initialization_error', ({ message }) => fail(message));
      this.player?.addListener('authentication_error', ({ message }) => fail(message));
      this.player?.addListener('account_error', ({ message }) => fail(message));
      this.player?.addListener('playback_error', ({ message }) => {
        console.error('Falha no playback Spotify:', message);
      });
    });

    let connected: boolean;

    try {
      connected = await this.player.connect();
    } catch (error: unknown) {
      readyPromise.catch(() => undefined);

      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }

      throw error;
    }

    if (!connected) {
      readyPromise.catch(() => undefined);

      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }

      throw new Error(
        'Nao foi possivel criar um dispositivo de reproducao Spotify. Verifique se a conta conectada tem Premium e se o navegador permite o Web Playback SDK.'
      );
    }

    return readyPromise;
  }

  private resetPlayer(): void {
    this.deviceId = undefined;
    this.connectPromise = undefined;
    this.player?.disconnect();
    this.player = undefined;
  }

  private async getPlaybackAccessToken(): Promise<string> {
    const token = await firstValueFrom(this.spotifyService.getPlaybackToken());
    return token.accessToken;
  }

  private normalizeError(error: unknown): Error {
    const message = this.readErrorMessage(error);

    if (message) {
      return new Error(message);
    }

    return new Error('Nao foi possivel conectar o player.');
  }

  private readErrorMessage(error: unknown): string {
    if (this.isRecord(error)) {
      const payload = error['error'];

      if (typeof payload === 'string' && payload) {
        return payload;
      }

      if (this.isRecord(payload)) {
        const payloadError = payload['error'];
        const payloadMessage = payload['message'];

        if (typeof payloadError === 'string' && payloadError) {
          return payloadError;
        }

        if (typeof payloadMessage === 'string' && payloadMessage) {
          return payloadMessage;
        }
      }

      if (error['status'] === 404) {
        return 'Conta Spotify nao conectada.';
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return '';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private loadSdk(): Promise<void> {
    if (window.Spotify) {
      return Promise.resolve();
    }

    if (this.sdkPromise) {
      return this.sdkPromise;
    }

    this.sdkPromise = new Promise<void>((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve();

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://sdk.scdn.co/spotify-player.js"]'
      );

      if (existingScript) {
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.onerror = () => reject(new Error('Nao foi possivel carregar o SDK de reproducao.'));
      document.body.appendChild(script);
    });

    return this.sdkPromise;
  }
}
