import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Track } from '../../shared/models/track.model';
import { SpotifyWebPlaybackService } from './spotify-web-playback.service';

@Injectable()
export class PlayerService {
  private readonly spotifyPlayback = inject(SpotifyWebPlaybackService);
  private readonly audio = new Audio();
  private readonly currentTrackSubject = new BehaviorSubject<Track | null>(null);
  private readonly isPlayingSubject = new BehaviorSubject<boolean>(false);
  private readonly progressSubject = new BehaviorSubject<number>(0);
  private usingSpotifyPlayback = false;

  readonly currentTrack$: Observable<Track | null> = this.currentTrackSubject.asObservable();
  readonly isPlaying$: Observable<boolean> = this.isPlayingSubject.asObservable();
  readonly progress$: Observable<number> = this.progressSubject.asObservable();

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
      console.error('Falha ao reproduzir musica completa:', error);
      this.playPreview(track);
    });
  }

  private playPreview(track: Track): void {
    if (!track.previewUrl) {
      this.usingSpotifyPlayback = false;
      this.isPlayingSubject.next(false);
      return;
    }

    this.usingSpotifyPlayback = false;
    this.audio.src = track.previewUrl;

    this.audio.play()
      .then(() => this.isPlayingSubject.next(true))
      .catch((error: unknown) => {
        console.error('Falha ao reproduzir preview:', error);
        this.isPlayingSubject.next(false);
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
}
