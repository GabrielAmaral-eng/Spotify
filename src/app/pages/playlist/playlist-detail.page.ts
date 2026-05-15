import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { PlayerService } from '../../core/services/player.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { Playlist } from '../../shared/models/playlist.model';
import { Track } from '../../shared/models/track.model';

@Component({
  selector: 'app-playlist-detail',
  templateUrl: './playlist-detail.page.html',
  styleUrls: ['./playlist.page.scss'],
  standalone: false
})
export class PlaylistDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly playlistService = inject(PlaylistService);
  private readonly playerService = inject(PlayerService);
  private readonly toastController = inject(ToastController);
  private readonly destroy$ = new Subject<void>();

  playlist: Playlist | null = null;

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap((params) => this.playlistService.getPlaylist(params.get('id') ?? '')),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (playlist) => {
        this.playlist = playlist;
      },
      error: () => {
        this.presentToast('Playlist não encontrada.');
        this.router.navigate(['/playlists']);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  play(track: Track): void {
    this.playerService.play(track);
  }

  removeTrack(track: Track): void {
    if (!this.playlist) {
      return;
    }

    this.playlistService.removeTrackFromPlaylist(this.playlist.id, track.id).subscribe({
      next: () => {
        if (this.playlist) {
          this.playlist = {
            ...this.playlist,
            tracks: this.playlist.tracks.filter((item) => item.id !== track.id)
          };
        }
        this.presentToast('Música removida.');
      },
      error: () => this.presentToast('Não foi possível remover a música.')
    });
  }

  trackByTrackId(_index: number, track: Track): string {
    return track.id;
  }

  private presentToast(message: string): void {
    this.toastController.create({
      message,
      duration: 1800,
      position: 'bottom'
    }).then((toast) => toast.present());
  }
}
