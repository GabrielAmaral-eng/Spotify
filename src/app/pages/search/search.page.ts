import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
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

  readonly mockSongs: ReadonlyArray<{ id: string; title: string; artist: string }> = [
    { id: 'eclipse', title: 'Eclipse dos Dias', artist: 'Tessália' },
    { id: 'horizonte', title: 'Horizonte de Neon', artist: 'Vértice' },
    { id: 'coracao', title: 'Coração de Fumaça', artist: 'Lunário' },
    { id: 'alem', title: 'Além do Silêncio', artist: 'Aurora Vex' },
    { id: 'fragmentos', title: 'Fragmentos do Amanhã', artist: 'Sideral' },
    { id: 'mares', title: 'Marés Internas', artist: 'Oceânica' },
    { id: 'ultima', title: 'Última Estação', artist: 'Subtérreo' },
    { id: 'luz', title: 'Luz que Fica', artist: 'Minimalista' },
    { id: 'sombras', title: 'Sombras de Cristal', artist: 'Nebulosa' },
    { id: 'pulsar', title: 'Pulsar do Vazio', artist: 'Cassiopeia' },
    { id: 'ecos', title: 'Ecos do Norte', artist: 'Arcano' },
    { id: 'ressonancia', title: 'Ressonância Plena', artist: 'Vértex' }
  ];
  selectedSongIndex = 3;
  private lastWheelTime = 0;

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

  trackBySongId(_index: number, song: { id: string }): string {
    return song.id;
  }

  getOffsetForSong(songIdx: number): number {
    const length = this.mockSongs.length;
    let offset = songIdx - this.selectedSongIndex;
    while (offset > length / 2) offset -= length;
    while (offset <= -length / 2) offset += length;
    return offset;
  }

  getItemTransform(offset: number): string {
    const itemSpacing = 72;
    const radius = 520;
    const y = offset * itemSpacing;
    const x = -radius + Math.sqrt(Math.max(0, radius * radius - y * y));
    return `translate(${x}px, calc(-50% + ${y}px))`;
  }

  getItemOpacity(offset: number): number {
    const d = Math.abs(offset);
    if (d === 0) return 1;
    if (d === 1) return 0.75;
    if (d === 2) return 0.45;
    if (d === 3) return 0.15;
    return 0;
  }

  selectPrev(): void {
    const length = this.mockSongs.length;
    this.selectedSongIndex = (this.selectedSongIndex - 1 + length) % length;
  }

  selectNext(): void {
    const length = this.mockSongs.length;
    this.selectedSongIndex = (this.selectedSongIndex + 1) % length;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const now = Date.now();
    if (now - this.lastWheelTime < 130) return;
    this.lastWheelTime = now;

    if (event.deltaY < 0) {
      this.selectPrev();
    } else if (event.deltaY > 0) {
      this.selectNext();
    }
  }

  onWheelMouseEnter(event: MouseEvent): void {
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (this.loading || this.query) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectPrev();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectNext();
    }
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
