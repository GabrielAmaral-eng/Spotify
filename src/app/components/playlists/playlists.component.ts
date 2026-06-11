import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { PlaylistService } from '../../core/services/playlist.service';
import { Playlist } from '../../shared/models/playlist.model';

@Component({
  selector: 'app-playlists',
  templateUrl: './playlists.component.html',
  styleUrls: ['./playlists.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class PlaylistsComponent {
  @Input() open = false;
  @Output() selectPlaylist = new EventEmitter<Playlist>();

  private readonly playlistService = inject(PlaylistService);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);

  readonly playlists$ = this.playlistService.playlists$;

  onPlaylistClick(playlist: Playlist): void {
    this.selectPlaylist.emit(playlist);
  }

  async onCreatePlaylist(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Nova playlist',
      inputs: [
        {
          name: 'name',
          placeholder: 'Nome da playlist',
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
              next: () => this.presentToast('Playlist criada com sucesso.'),
              error: () => this.presentToast('Não foi possível criar a playlist.')
            });

            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  private presentToast(message: string): void {
    this.toastController.create({
      message,
      duration: 1800,
      position: 'bottom'
    }).then((toast) => toast.present());
  }
}