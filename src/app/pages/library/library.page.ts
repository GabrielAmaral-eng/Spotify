import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { PlayerService } from '../../core/services/player.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { Playlist } from '../../shared/models/playlist.model';
import { Track } from '../../shared/models/track.model';

type LibrarySegment = 'favorites' | 'playlists';

@Component({
  selector: 'app-library',
  templateUrl: './library.page.html',
  styleUrls: ['./library.page.scss'],
  standalone: false
})
export class LibraryPage implements OnInit {
  private readonly playlistService = inject(PlaylistService);
  private readonly playerService = inject(PlayerService);
  private readonly toastController = inject(ToastController);
  private readonly router = inject(Router);

  readonly favorites$ = this.playlistService.favorites$;
  readonly playlists$ = this.playlistService.playlists$;
  segment: LibrarySegment = 'favorites';

  ngOnInit(): void {
    this.playlistService.loadFavorites().subscribe();
    this.playlistService.loadPlaylists().subscribe();
  }

  segmentChanged(event: Event): void {
    const value = (event as CustomEvent<{ value?: LibrarySegment }>).detail.value;
    this.segment = value ?? 'favorites';
  }

  play(track: Track): void {
    this.playerService.play(track);
  }

  removeFavorite(track: Track): void {
    this.playlistService.unfavoriteTrack(track.id).subscribe({
      next: () => this.presentToast('Favorito removido.'),
      error: () => this.presentToast('Não foi possível remover o favorito.')
    });
  }

  openPlaylist(playlist: Playlist): void {
    this.router.navigate(['/playlists', playlist.id]);
  }

  trackByTrackId(_index: number, track: Track): string {
    return track.id;
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
