import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Track } from '../../shared/models/track.model';

@Injectable()
export class PlayerService {
  private readonly audio = new Audio();
  private readonly currentTrackSubject = new BehaviorSubject<Track | null>(null);
  private readonly isPlayingSubject = new BehaviorSubject<boolean>(false);
  private readonly progressSubject = new BehaviorSubject<number>(0);

  readonly currentTrack$: Observable<Track | null> = this.currentTrackSubject.asObservable();
  readonly isPlaying$: Observable<boolean> = this.isPlayingSubject.asObservable();
  readonly progress$: Observable<number> = this.progressSubject.asObservable();

  constructor() {
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => {
      this.isPlayingSubject.next(false);
      this.progressSubject.next(100);
    });
  }

  play(track: Track): void {
    if (!track.previewUrl) {
      return;
    }

    const currentTrack = this.currentTrackSubject.value;

    if (currentTrack?.id !== track.id) {
      this.audio.src = track.previewUrl;
      this.progressSubject.next(0);
      this.currentTrackSubject.next(track);
    }

    this.audio.play()
      .then(() => this.isPlayingSubject.next(true))
      .catch((error: unknown) => {
        console.error('Falha ao reproduzir preview:', error);
        this.isPlayingSubject.next(false);
      });
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
        .catch((error: unknown) => {
          console.error('Falha ao retomar preview:', error);
        });
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
}
