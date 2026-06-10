import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Track } from '../../shared/models/track.model';

@Injectable()
export class PlayerService {
  private readonly audio = new Audio();
  private readonly currentTrackSubject = new BehaviorSubject<Track | null>(null);
  private readonly isPlayingSubject = new BehaviorSubject<boolean>(false);
  private readonly progressSubject = new BehaviorSubject<number>(0);
  private readonly playbackMessageSubject = new Subject<string>();

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
  }

  play(track: Track): void {
    const currentTrack = this.currentTrackSubject.value;

    if (currentTrack?.id !== track.id) {
      this.progressSubject.next(0);
      this.currentTrackSubject.next(track);
    }

    this.startPlayback(track);
  }

  private startPlayback(track: Track): void {
    if (!track.previewUrl) {
      this.clearAudio();
      this.isPlayingSubject.next(false);
      this.progressSubject.next(0);
      this.playbackMessageSubject.next('Esta musica nao esta disponivel para reproducao.');
      return;
    }

    this.audio.src = track.previewUrl;

    this.audio.play()
      .then(() => this.isPlayingSubject.next(true))
      .catch((error: unknown) => this.handlePlaybackError(error));
  }

  pause(): void {
    this.audio.pause();
    this.isPlayingSubject.next(false);
  }

  toggle(): void {
    if (!this.currentTrackSubject.value) {
      return;
    }

    if (this.audio.paused) {
      this.audio.play()
        .then(() => this.isPlayingSubject.next(true))
        .catch((error: unknown) => this.handlePlaybackError(error));
      return;
    }

    this.pause();
  }

  seekToPercent(percent: number): void {
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

  private clearAudio(): void {
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  private handlePlaybackError(error: unknown): void {
    // O play() rejeita com AbortError quando a reproducao e interrompida por
    // uma nova faixa ou por um pause antes de o audio terminar de carregar.
    // Isso nao e uma falha real, entao ignoramos silenciosamente.
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    console.error('Falha ao reproduzir a musica:', error);
    this.isPlayingSubject.next(false);
    this.playbackMessageSubject.next('Nao foi possivel reproduzir esta musica.');
  }
}
