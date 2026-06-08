import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Track } from '../../shared/models/track.model';
import { SpotifyWebPlaybackService } from './spotify-web-playback.service';

@Injectable()
export class PlayerService {
  private readonly spotifyPlayback = inject(SpotifyWebPlaybackService);
  private readonly audio = new Audio();
  private readonly currentTrackSubject = new BehaviorSubject<Track | null>(null);
  private readonly isPlayingSubject = new BehaviorSubject<boolean>(false);
  private readonly progressSubject = new BehaviorSubject<number>(0);
  private readonly playbackMessageSubject = new Subject<string>();
  private usingSpotifyPlayback = false;

  readonly currentTrack$: Observable<Track | null> = this.currentTrackSubject.asObservable();
  readonly isPlaying$: Observable<boolean> = this.isPlayingSubject.asObservable();
  readonly progress$: Observable<number> = this.progressSubject.asObservable();
  readonly playbackMessage$: Observable<string> = this.playbackMessageSubject.asObservable();

  constructor() {
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => {
      this.isPlayingSubject.next(false);
      this.progressSubject.next(100);
    });
    this.spotifyPlayback.state$.subscribe((state) => {
      if (!this.usingSpotifyPlayback || !state) {
        return;
      }

      this.isPlayingSubject.next(!state.paused);

      if (state.duration > 0) {
        const progress = (state.position / state.duration) * 100;
        this.progressSubject.next(Math.min(100, Math.max(0, progress)));
      }
    });
  }

  play(track: Track): void {
    const currentTrack = this.currentTrackSubject.value;

    if (currentTrack?.id !== track.id) {
      this.progressSubject.next(0);
      this.currentTrackSubject.next(track);
    }

    this.playWithConnectedAccount(track).catch((error: unknown) => {
      console.warn('Playback completo indisponivel; tentando preview:', error);
      this.playPreview(track, this.getFullPlaybackFailureMessage(error));
    });
  }

  private playPreview(track: Track, fullPlaybackFailureMessage?: string): void {
    if (!track.previewUrl) {
      this.usingSpotifyPlayback = false;
      this.clearPreview();
      this.isPlayingSubject.next(false);
      this.progressSubject.next(0);
      this.playbackMessageSubject.next(
        fullPlaybackFailureMessage ?? 'Nao foi possivel reproduzir esta musica.'
      );
      return;
    }

    this.usingSpotifyPlayback = false;
    this.audio.src = track.previewUrl;

    this.audio.play()
      .then(() => {
        this.isPlayingSubject.next(true);

        if (fullPlaybackFailureMessage) {
          this.playbackMessageSubject.next('Player Spotify indisponivel; tocando preview da musica.');
        }
      })
      .catch((error: unknown) => {
        console.error('Falha ao reproduzir preview:', error);
        this.isPlayingSubject.next(false);
        this.playbackMessageSubject.next('Nao foi possivel reproduzir o preview desta musica.');
      });
  }

  pause(): void {
    if (this.usingSpotifyPlayback) {
      this.spotifyPlayback.pause().catch((error: unknown) => {
        console.error('Falha ao pausar player conectado:', error);
      });
      this.isPlayingSubject.next(false);
      return;
    }

    this.audio.pause();
    this.isPlayingSubject.next(false);
  }

  toggle(): void {
    if (!this.currentTrackSubject.value) {
      return;
    }

    if (this.usingSpotifyPlayback) {
      this.spotifyPlayback.toggle()
        .then(() => this.isPlayingSubject.next(!this.isPlayingSubject.value))
        .catch((error: unknown) => {
          console.error('Falha ao alternar player conectado:', error);
        });
      return;
    }

    if (this.audio.paused) {
      this.audio.play()
        .then(() => this.isPlayingSubject.next(true))
        .catch((error: unknown) => {
          console.error('Falha ao retomar preview:', error);
        });
      return;
    }

    this.pause();
  }

  seekToPercent(percent: number): void {
    if (this.usingSpotifyPlayback) {
      const state = this.spotifyPlayback.currentState;

      if (!state || state.duration <= 0) {
        return;
      }

      const positionMs = Math.round((state.duration * percent) / 100);
      this.spotifyPlayback.seek(positionMs).catch((error: unknown) => {
        console.error('Falha ao buscar posicao no player conectado:', error);
      });
      return;
    }

    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
      return;
    }

    this.audio.currentTime = (this.audio.duration * percent) / 100;
  }

  private updateProgress(): void {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
      this.progressSubject.next(0);
      return;
    }

    const progress = (this.audio.currentTime / this.audio.duration) * 100;
    this.progressSubject.next(Math.min(100, Math.max(0, progress)));
  }

  private async playWithConnectedAccount(track: Track): Promise<void> {
    this.audio.pause();
    await this.spotifyPlayback.play(track.id);
    this.usingSpotifyPlayback = true;
    this.isPlayingSubject.next(true);
  }

  private clearPreview(): void {
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  private getFullPlaybackFailureMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('Conta Spotify nao conectada')) {
      return 'Conecte sua conta Spotify para tocar a musica completa.';
    }

    return 'Nao foi possivel iniciar o player Spotify. Para tocar a musica completa, use uma conta Spotify Premium e permita o player no navegador.';
  }
}
