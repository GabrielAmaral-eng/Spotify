import { Component, Input, Output, EventEmitter, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
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
  @Output() requestClose = new EventEmitter<void>();

  private readonly playlistService = inject(PlaylistService);
  private readonly toastController = inject(ToastController);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly playlists$ = this.playlistService.playlists$;

  // Estado do pop-up "Criar nova playlist" (elemento HTML próprio)
  showCreatePopup = false;
  newPlaylistName = '';
  newPlaylistDescription = '';

  // Estado do menu dropdown de opções da playlist (3 pontos) — elemento HTML próprio
  showOptionsPopup = false;
  optionsPlaylist: Playlist | null = null;
  optionsTop = 0;
  optionsRight = 0;

  // Estado do pop-up de confirmação de exclusão de playlist — elemento HTML próprio
  showDeletePopup = false;
  deletePlaylistTarget: Playlist | null = null;

  // Estado do pop-up "Gerenciar músicas" — elemento HTML próprio
  showManagePopup = false;
  managePlaylist: Playlist | null = null;
  manageTracks: Track[] = [];

  // Confirmação de remoção de música (dentro do gerenciar músicas)
  showRemoveTrackPopup = false;
  removeTrackTarget: Track | null = null;

  // Estado do pop-up "Renomear playlist" — elemento HTML próprio
  showRenamePopup = false;
  renamePlaylistTarget: Playlist | null = null;
  renameName = '';
  renameDescription = '';

  onPlaylistClick(playlist: Playlist): void {
    this.selectPlaylist.emit(playlist);
  }

  /**
   * Fecha o painel ao clicar fora dele. O botão de toggle no componente pai
   * chama stopPropagation, então cliques nele não chegam até aqui (evitando
   * conflito com o próprio toggle). Apenas emite o pedido de fechar — o pai
   * controla `open`, preservando a animação de fechar via transição CSS.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open) {
      return;
    }

    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.requestClose.emit();
    }
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

    // Ancora o dropdown logo abaixo do botão dos 3 pontos, alinhado à direita.
    const target = event.currentTarget as HTMLElement | null;
    if (target) {
      const rect = target.getBoundingClientRect();
      this.optionsTop = rect.bottom + 6;
      this.optionsRight = window.innerWidth - rect.right;
    }

    this.optionsPlaylist = playlist;
    this.showOptionsPopup = true;
  }

  onOptionRename(): void {
    const playlist = this.optionsPlaylist;
    this.closePlaylistOptions();

    if (playlist) {
      this.openRenamePlaylist(playlist);
    }
  }

  onOptionManageTracks(): void {
    const playlist = this.optionsPlaylist;
    this.closePlaylistOptions();

    if (playlist) {
      this.openManageTracks(playlist);
    }
  }

  onOptionDelete(): void {
    const playlist = this.optionsPlaylist;
    this.closePlaylistOptions();

    if (playlist) {
      this.openDeletePlaylistConfirm(playlist);
    }
  }

  closePlaylistOptions(): void {
    this.showOptionsPopup = false;
    this.optionsPlaylist = null;
  }

  private openRenamePlaylist(playlist: Playlist): void {
    this.renamePlaylistTarget = playlist;
    this.renameName = playlist.name;
    this.renameDescription = playlist.description ?? '';
    this.showRenamePopup = true;
  }

  confirmRenamePlaylist(): void {
    const name = this.renameName.trim();

    if (!name) {
      return;
    }

    const playlist = this.renamePlaylistTarget;
    const description = this.renameDescription.trim();

    this.closeRenamePopup();

    if (!playlist) {
      return;
    }

    this.playlistService.updatePlaylist(playlist.id, name, description).subscribe({
      next: () => this.presentToast('Playlist renomeada.'),
      error: () => this.presentToast('Não foi possível renomear a playlist.')
    });
  }

  cancelRenamePlaylist(): void {
    this.closeRenamePopup();
  }

  private closeRenamePopup(): void {
    this.showRenamePopup = false;
    this.renamePlaylistTarget = null;
    this.renameName = '';
    this.renameDescription = '';
  }

  private openDeletePlaylistConfirm(playlist: Playlist): void {
    this.deletePlaylistTarget = playlist;
    this.showDeletePopup = true;
  }

  confirmDeletePlaylist(): void {
    const playlist = this.deletePlaylistTarget;
    this.closeDeletePopup();

    if (!playlist) {
      return;
    }

    this.playlistService.deletePlaylist(playlist.id).subscribe({
      next: () => this.presentToast('Playlist excluída.'),
      error: () => this.presentToast('Não foi possível excluir a playlist.')
    });
  }

  cancelDeletePlaylist(): void {
    this.closeDeletePopup();
  }

  private closeDeletePopup(): void {
    this.showDeletePopup = false;
    this.deletePlaylistTarget = null;
  }

  private openManageTracks(playlist: Playlist): void {
    if (!playlist.tracks || playlist.tracks.length === 0) {
      this.presentToast('Esta playlist não possui músicas.');
      return;
    }

    this.managePlaylist = playlist;
    this.manageTracks = [...playlist.tracks];
    this.showManagePopup = true;
  }

  removeManagedTrack(track: Track): void {
    this.removeTrackTarget = track;
    this.showRemoveTrackPopup = true;
  }

  confirmRemoveTrack(): void {
    const playlist = this.managePlaylist;
    const track = this.removeTrackTarget;
    this.closeRemoveTrackPopup();

    if (!playlist || !track) {
      return;
    }

    this.playlistService.removeTrackFromPlaylist(playlist.id, track.id).subscribe({
      next: () => {
        this.presentToast('Música removida da playlist.');
        this.playlistService.loadPlaylists().subscribe();
        this.manageTracks = this.manageTracks.filter((t) => t.id !== track.id);

        if (this.manageTracks.length === 0) {
          this.closeManagePopup();
        }
      },
      error: () => this.presentToast('Não foi possível remover a música.')
    });
  }

  cancelRemoveTrack(): void {
    this.closeRemoveTrackPopup();
  }

  private closeRemoveTrackPopup(): void {
    this.showRemoveTrackPopup = false;
    this.removeTrackTarget = null;
  }

  closeManagePopup(): void {
    this.showManagePopup = false;
    this.managePlaylist = null;
    this.manageTracks = [];
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