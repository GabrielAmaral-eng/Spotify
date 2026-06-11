import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { PlaylistService } from '../../core/services/playlist.service';
import { Playlist } from '../../shared/models/playlist.model';
import { Track } from '../../shared/models/track.model';

@Component({
  selector: 'app-playlists',
  templateUrl: './playlists.component.html',
  styleUrls: ['./playlists.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class PlaylistsComponent {
  @Input() open = false;
  @Output() selectPlaylist = new EventEmitter<Playlist>();

  private readonly playlistService = inject(PlaylistService);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);

  readonly playlists$ = this.playlistService.playlists$;

  // Estado do pop-up "Criar nova playlist" (elemento HTML próprio)
  showCreatePopup = false;
  newPlaylistName = '';
  newPlaylistDescription = '';

  // Estado do pop-up de opções da playlist (3 pontos) — elemento HTML próprio
  showOptionsPopup = false;
  optionsPlaylist: Playlist | null = null;

  onPlaylistClick(playlist: Playlist): void {
    this.selectPlaylist.emit(playlist);
  }

  onCreatePlaylist(): void {
    this.newPlaylistName = '';
    this.newPlaylistDescription = '';
    this.showCreatePopup = true;
  }

  confirmCreatePlaylist(): void {
    const name = this.newPlaylistName.trim();

    if (!name) {
      return;
    }

    const description = this.newPlaylistDescription.trim();

    this.closeCreatePopup();

    this.playlistService.createPlaylist(name, description).subscribe({
      next: () => this.presentToast('Playlist criada com sucesso.'),
      error: () => this.presentToast('Não foi possível criar a playlist.')
    });
  }

  cancelCreatePlaylist(): void {
    this.closeCreatePopup();
  }

  private closeCreatePopup(): void {
    this.showCreatePopup = false;
    this.newPlaylistName = '';
    this.newPlaylistDescription = '';
  }

  onPlaylistOptions(event: Event, playlist: Playlist): void {
    event.stopPropagation();
    this.optionsPlaylist = playlist;
    this.showOptionsPopup = true;
  }

  onOptionViewTracks(): void {
    const playlist = this.optionsPlaylist;
    this.closePlaylistOptions();

    if (playlist) {
      this.selectPlaylist.emit(playlist);
    }
  }

  onOptionRename(): void {
    const playlist = this.optionsPlaylist;
    this.closePlaylistOptions();

    if (playlist) {
      this.promptRenamePlaylist(playlist).catch(() => undefined);
    }
  }

  onOptionManageTracks(): void {
    const playlist = this.optionsPlaylist;
    this.closePlaylistOptions();

    if (playlist) {
      this.promptManageTracks(playlist).catch(() => undefined);
    }
  }

  onOptionDelete(): void {
    const playlist = this.optionsPlaylist;
    this.closePlaylistOptions();

    if (playlist) {
      this.promptDeletePlaylist(playlist).catch(() => undefined);
    }
  }

  closePlaylistOptions(): void {
    this.showOptionsPopup = false;
    this.optionsPlaylist = null;
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