import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
  takeUntil,
  tap
} from 'rxjs';
import { PlayerService } from '../../core/services/player.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { SpotifyService } from '../../core/services/spotify.service';
import { Track } from '../../shared/models/track.model';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: false
})
export class SearchPage implements OnInit, OnDestroy {
  private readonly spotifyService = inject(SpotifyService);
  private readonly playerService = inject(PlayerService);
  private readonly playlistService = inject(PlaylistService);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly searchTerms = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly favoriteIds$ = this.playlistService.favoriteIds$;
  results: Track[] = [];
  query = '';
  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.playlistService.loadPlaylists().pipe(takeUntil(this.destroy$)).subscribe();
    this.playlistService.loadFavorites().pipe(takeUntil(this.destroy$)).subscribe();

    this.searchTerms.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      tap((term) => {
        this.errorMessage = '';
        this.loading = term.length > 0;
        if (!term) {
          this.results = [];
        }
      }),
      switchMap((term) => {
        if (!term) {
          return of([]);
        }

        return this.spotifyService.searchTracks(term).pipe(
          catchError(() => {
            this.errorMessage = 'Não foi possível buscar músicas agora.';
            return of([]);
          }),
          finalize(() => {
            this.loading = false;
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((tracks) => {
      this.results = tracks;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(event: Event): void {
    const value = (event as CustomEvent<{ value?: string | null }>).detail.value ?? '';
    this.query = value.trim();
    this.searchTerms.next(this.query);
  }

  play(track: Track): void {
    this.playerService.play(track);
  }

  toggleFavorite(track: Track): void {
    this.playlistService.toggleFavorite(track).subscribe({
      next: () => undefined,
      error: () => {
        this.presentToast('Não foi possível atualizar os favoritos.');
      }
    });
  }

  async addToPlaylist(track: Track): Promise<void> {
    const playlists = this.playlistService.playlistsSnapshot;

    if (playlists.length === 0) {
      await this.promptCreatePlaylist(track);
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
          text: 'Nova playlist',
          handler: () => {
            this.promptCreatePlaylist(track).catch(() => undefined);
          }
        },
        {
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  trackByTrackId(_index: number, track: Track): string {
    return track.id;
  }

  private async promptCreatePlaylist(track: Track): Promise<void> {
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
              next: (playlist) => {
                this.playlistService.addTrackToPlaylist(playlist.id, track).subscribe({
                  next: () => this.presentToast('Playlist criada com a música.'),
                  error: () => this.presentToast('Playlist criada, mas a música não entrou.')
                });
              },
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
