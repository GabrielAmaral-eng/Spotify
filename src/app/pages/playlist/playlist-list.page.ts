import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { PlaylistService } from '../../core/services/playlist.service';
import { Playlist } from '../../shared/models/playlist.model';

@Component({
  selector: 'app-playlist-list',
  templateUrl: './playlist-list.page.html',
  styleUrls: ['./playlist.page.scss'],
  standalone: false
})
export class PlaylistListPage implements OnInit {
  private readonly playlistService = inject(PlaylistService);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly router = inject(Router);

  readonly playlists$ = this.playlistService.playlists$;

  ngOnInit(): void {
    this.playlistService.loadPlaylists().subscribe();
  }

  openPlaylist(playlist: Playlist): void {
    this.router.navigate(['/playlists', playlist.id]);
  }

  async createPlaylist(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Nova playlist',
      inputs: [
        {
          name: 'name',
          placeholder: 'Nome',
          type: 'text'
        },
        {
          name: 'description',
          placeholder: 'Descrição opcional',
          type: 'textarea'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Criar',
          handler: (data: { name?: string; description?: string }) => {
            const name = data.name?.trim();

            if (!name) {
              return false;
            }

            this.playlistService.createPlaylist(name, data.description?.trim()).subscribe({
              next: () => this.presentToast('Playlist criada.'),
              error: () => this.presentToast('Não foi possível criar a playlist.')
            });

            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  deletePlaylist(event: Event, playlist: Playlist): void {
    event.stopPropagation();
    this.playlistService.deletePlaylist(playlist.id).subscribe({
      next: () => this.presentToast('Playlist removida.'),
      error: () => this.presentToast('Não foi possível remover a playlist.')
    });
  }

  trackByPlaylistId(_index: number, playlist: Playlist): string {
    return playlist.id;
  }

  private presentToast(message: string): void {
    this.toastController.create({
      message,
      duration: 1800,
      position: 'bottom'
    }).then((toast) => toast.present());
  }
}
