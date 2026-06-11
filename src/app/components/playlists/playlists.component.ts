import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { PlaylistService } from '../../core/services/playlist.service';
import { Playlist } from '../../shared/models/playlist.model';
import { Track } from '../../shared/models/track.model';

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
  private readonly actionSheetController = inject(ActionSheetController);
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

  async onPlaylistOptions(event: Event, playlist: Playlist): Promise<void> {
    event.stopPropagation();

    const actionSheet = await this.actionSheetController.create({
      header: playlist.name,
      buttons: [
        {
          text: 'Ver músicas',
          icon: 'musical-notes-outline',
          handler: () => {
            this.selectPlaylist.emit(playlist);
          }
        },
        {
          text: 'Renomear',
          icon: 'pencil-outline',
          handler: () => {
            this.promptRenamePlaylist(playlist).catch(() => undefined);
          }
        },
        {
          text: 'Gerenciar músicas',
          icon: 'list-outline',
          handler: () => {
            this.promptManageTracks(playlist).catch(() => undefined);
          }
        },
        {
          text: 'Excluir playlist',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            this.promptDeletePlaylist(playlist).catch(() => undefined);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  private async promptRenamePlaylist(playlist: Playlist): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Renomear playlist',
      inputs: [
        {
          name: 'name',
          placeholder: 'Novo nome',
          type: 'text',
          value: playlist.name
        },
        {
          name: 'description',
          placeholder: 'Descrição',
          type: 'textarea',
          value: playlist.description ?? ''
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (data: { name?: string; description?: string }) => {
            const name = data.name?.trim();

            if (!name) {
              return false;
            }

            this.playlistService.updatePlaylist(playlist.id, name, data.description?.trim()).subscribe({
              next: () => this.presentToast('Playlist renomeada.'),
              error: () => this.presentToast('Não foi possível renomear a playlist.')
            });

            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  private async promptDeletePlaylist(playlist: Playlist): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Excluir playlist',
      message: `Tem certeza que deseja excluir "${playlist.name}"? Esta ação não pode ser desfeita.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Excluir',
          role: 'destructive',
          handler: () => {
            this.playlistService.deletePlaylist(playlist.id).subscribe({
              next: () => this.presentToast('Playlist excluída.'),
              error: () => this.presentToast('Não foi possível excluir a playlist.')
            });
          }
        }
      ]
    });

    await alert.present();
  }

  private async promptManageTracks(playlist: Playlist): Promise<void> {
    if (!playlist.tracks || playlist.tracks.length === 0) {
      this.presentToast('Esta playlist não possui músicas.');
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      header: `Músicas de "${playlist.name}"`,
      buttons: [
        ...playlist.tracks.map((track: Track) => ({
          text: `${track.title} — ${track.artist}`,
          icon: 'remove-circle-outline',
          role: undefined as string | undefined,
          handler: () => {
            this.promptRemoveTrack(playlist, track).catch(() => undefined);
          }
        })),
        {
          text: 'Fechar',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  private async promptRemoveTrack(playlist: Playlist, track: Track): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Remover música',
      message: `Remover "${track.title}" de "${playlist.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Remover',
          role: 'destructive',
          handler: () => {
            this.playlistService.removeTrackFromPlaylist(playlist.id, track.id).subscribe({
              next: () => {
                this.presentToast('Música removida da playlist.');
                this.playlistService.loadPlaylists().subscribe();
              },
              error: () => this.presentToast('Não foi possível remover a música.')
            });
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