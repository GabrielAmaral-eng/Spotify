import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { PlaylistService } from '../../core/services/playlist.service';
import {
  SpotifyConnectionStatus,
  SpotifyService
} from '../../core/services/spotify.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly playlistService = inject(PlaylistService);
  private readonly spotifyService = inject(SpotifyService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastController = inject(ToastController);

  readonly playlists$ = this.playlistService.playlists$;
  readonly favorites$ = this.playlistService.favorites$;
  spotifyConnection: SpotifyConnectionStatus = { connected: false };
  spotifyLoading = true;
  spotifyActionLoading = false;

  ngOnInit(): void {
    this.playlistService.loadPlaylists().subscribe();
    this.playlistService.loadFavorites().subscribe();
    this.loadSpotifyConnection();

    const spotifyResult = this.route.snapshot.queryParamMap.get('spotify');

    if (spotifyResult === 'connected') {
      this.presentToast('Conta Spotify conectada.');
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { spotify: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }

    if (spotifyResult === 'denied') {
      this.presentToast('Conexao com Spotify cancelada.');
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { spotify: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }

  connectSpotify(): void {
    this.spotifyActionLoading = true;
    this.spotifyService.getAuthorizationUrl().subscribe({
      next: (authorizeUrl) => {
        window.location.href = authorizeUrl;
      },
      error: () => {
        this.spotifyActionLoading = false;
        this.presentToast('Nao foi possivel iniciar a conexao com o Spotify.');
      }
    });
  }

  disconnectSpotify(): void {
    this.spotifyActionLoading = true;
    this.spotifyService.disconnect().subscribe({
      next: () => {
        this.spotifyConnection = { connected: false };
        this.spotifyActionLoading = false;
        this.presentToast('Conta Spotify desconectada.');
      },
      error: () => {
        this.spotifyActionLoading = false;
        this.presentToast('Nao foi possivel desconectar o Spotify.');
      }
    });
  }

  private loadSpotifyConnection(): void {
    this.spotifyLoading = true;
    this.spotifyService.getConnectionStatus().subscribe({
      next: (connection) => {
        this.spotifyConnection = connection;
        this.spotifyLoading = false;
      },
      error: () => {
        this.spotifyConnection = { connected: false };
        this.spotifyLoading = false;
      }
    });
  }

  private presentToast(message: string): void {
    this.toastController
      .create({
        message,
        duration: 1800,
        position: 'bottom'
      })
      .then((toast) => toast.present());
  }
}
