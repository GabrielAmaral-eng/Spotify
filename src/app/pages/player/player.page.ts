import { Component, OnInit, inject } from '@angular/core';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { PlayerService } from '../../core/services/player.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { Track } from '../../shared/models/track.model';

@Component({
  selector: 'app-player',
  templateUrl: './player.page.html',
  styleUrls: ['./player.page.scss'],
  standalone: false
})
export class PlayerPage implements OnInit {
  private readonly playerService = inject(PlayerService);
  private readonly playlistService = inject(PlaylistService);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly toastController = inject(ToastController);

  readonly currentTrack$ = this.playerService.currentTrack$;
  readonly isPlaying$ = this.playerService.isPlaying$;
  readonly progress$ = this.playerService.progress$;
  readonly favoriteIds$ = this.playlistService.favoriteIds$;

  ngOnInit(): void {
    this.playlistService.loadPlaylists().subscribe();
    this.playlistService.loadFavorites().subscribe();
  }

  toggle(): void {
    this.playerService.toggle();
  }

  seek(event: Event): void {
    const value = (event as CustomEvent<{ value: number | number[] }>).detail.value;
    const progress = Array.isArray(value) ? value[0] : value;
    this.playerService.seekToPercent(progress);
  }

  progressToSeconds(progress: number | null | undefined, duration: number | null | undefined): number {
    const normalizedProgress = Math.min(100, Math.max(0, progress ?? 0));
    return ((duration ?? 0) * normalizedProgress) / 100;
  }

  toggleFavorite(track: Track): void {
    this.playlistService.toggleFavorite(track).subscribe({
      next: () => undefined,
      error: () => this.presentToast('Não foi possível atualizar os favoritos.')
    });
  }

  async addToPlaylist(track: Track): Promise<void> {
    const playlists = this.playlistService.playlistsSnapshot;

    if (playlists.length === 0) {
      this.presentToast('Crie uma playlist antes de adicionar músicas.');
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      header: 'Adicionar em',
      buttons: [
        ...playlists.map((playlist) => ({
          text: playlist.name,
          handler: () => {
            this.playlistService.addTrackToPlaylist(playlist.id, track).subscribe({
              next: () => this.presentToast('Música adicionada à playlist.'),
              error: () => this.presentToast('Não foi possível adicionar a música.')
            });
          }
        })),
        {
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  private presentToast(message: string): void {
    this.toastController.create({
      message,
      duration: 1800,
      position: 'bottom'
    }).then((toast) => toast.present());
  }
}
