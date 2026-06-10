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
import { AudiusService } from '../../core/services/audius.service';
import { Track } from '../../shared/models/track.model';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: false
})
export class SearchPage implements OnInit, OnDestroy {
  private readonly audiusService = inject(AudiusService);
  private readonly playerService = inject(PlayerService);
  private readonly playlistService = inject(PlaylistService);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly searchTerms = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly favoriteIds$ = this.playlistService.favoriteIds$;
  readonly isPlaying$ = this.playerService.isPlaying$;
  readonly currentTrack$ = this.playerService.currentTrack$;
  results: Track[] = [];
  query = '';
  loading = false;
  errorMessage = '';

  /** Controla a visibilidade do painel de playlists */
  showPlaylists = false;

  /** Musicas da ultima pesquisa, exibidas na roda rolavel e infinita. */
  wheelTracks: Track[] = [];
  selectedSongIndex = 0;
  private readonly wheelSelection$ = new Subject<void>();
  private lastWheelTime = 0;
  private wheelPointerActive = false;
  private wheelPointerId: number | null = null;
  private wheelPointerLastY = 0;
  private wheelPointerDelta = 0;
  private wheelPointerTravel = 0;
  private wheelPointerDownIndex: number | null = null;
  private readonly wheelPointerStep = 48;

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

        return this.audiusService.searchTracks(term).pipe(
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

    // Ao rolar a roda, toca a faixa central — so depois que a rolagem assenta,
    // para nao recarregar o stream a cada tique do scroll.
    this.wheelSelection$.pipe(
      debounceTime(300),
      takeUntil(this.destroy$)
    ).subscribe(() => this.playWheelSelection());

    // Botoes de voltar/avancar do player movem a roda (cima/baixo).
    this.playerService.skipPrevious$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.selectPrev());
    this.playerService.skipNext$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.selectNext());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Abre ou fecha o painel de playlists */
  togglePlaylists(): void {
    this.showPlaylists = !this.showPlaylists;
  }

  onSearch(event: Event): void {
    const value = (event as CustomEvent<{ value?: string | null }>).detail.value ?? '';
    this.query = value.trim();
    this.searchTerms.next(this.query);
  }

  play(track: Track): void {
    this.loadWheelFromResults(track);
    this.playerService.play(track);
    this.clearSearch();
  }

  /**
   * Guarda as sugestoes da pesquisa atual (no momento do clique) na roda e
   * centraliza na faixa escolhida.
   */
  private loadWheelFromResults(selected: Track): void {
    if (this.results.length === 0) {
      return;
    }

    this.wheelTracks = [...this.results];
    const index = this.wheelTracks.findIndex((track) => track.id === selected.id);
    this.selectedSongIndex = index >= 0 ? index : 0;
  }

  /** Toca a faixa atualmente centralizada/destacada na roda. */
  private playWheelSelection(): void {
    const track = this.wheelTracks[this.selectedSongIndex];
    if (track) {
      this.playerService.play(track);
    }
  }

  /** Limpa a barra de busca e os resultados ao selecionar uma musica. */
  private clearSearch(): void {
    this.query = '';
    this.results = [];
    this.searchTerms.next('');
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

  getOffsetForSong(songIdx: number): number {
    const length = this.wheelTracks.length;
    let offset = songIdx - this.selectedSongIndex;
    while (offset > length / 2) offset -= length;
    while (offset <= -length / 2) offset += length;
    return offset;
  }

  getItemTransform(offset: number): string {
    const compact = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    const itemSpacing = compact ? 62 : 72;
    const radius = compact ? 430 : 520;
    const y = offset * itemSpacing;
    const x = -radius + Math.sqrt(Math.max(0, radius * radius - y * y));
    return `translate(${x}px, calc(-50% + ${y}px))`;
  }

  getItemOpacity(offset: number): number {
    const d = Math.abs(offset);
    return Math.max(0, 1 - (d / 3.2) ** 2);
  }

  /** So faixas ainda visiveis (antes do fade completo) recebem clique. */
  getItemPointerEvents(offset: number): 'auto' | 'none' {
    return this.getItemOpacity(offset) > 0 ? 'auto' : 'none';
  }

  /** Seleciona ao clicar numa faixa visivel: a roda rola ate o centro e toca. */
  private selectByClick(index: number): void {
    if (index < 0 || index >= this.wheelTracks.length || index === this.selectedSongIndex) {
      return;
    }

    this.selectedSongIndex = index;
    this.wheelSelection$.next();
  }

  /** Descobre o indice da faixa sob o ponteiro a partir do data-attribute. */
  private resolveWheelIndex(event: PointerEvent): number | null {
    const item = (event.target as HTMLElement | null)?.closest<HTMLElement>('.wheel-item');
    const raw = item?.dataset['wheelIndex'];

    if (raw === undefined) {
      return null;
    }

    const index = Number(raw);
    return Number.isInteger(index) ? index : null;
  }

  selectPrev(): void {
    const length = this.wheelTracks.length;
    if (length === 0) return;
    this.selectedSongIndex = (this.selectedSongIndex - 1 + length) % length;
    this.wheelSelection$.next();
  }

  selectNext(): void {
    const length = this.wheelTracks.length;
    if (length === 0) return;
    this.selectedSongIndex = (this.selectedSongIndex + 1) % length;
    this.wheelSelection$.next();
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

  onWheelPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    this.wheelPointerActive = true;
    this.wheelPointerId = event.pointerId;
    this.wheelPointerLastY = event.clientY;
    this.wheelPointerDelta = 0;
    this.wheelPointerTravel = 0;
    this.wheelPointerDownIndex = this.resolveWheelIndex(event);

    const target = event.currentTarget as HTMLElement;
    target.focus({ preventScroll: true });
    target.setPointerCapture?.(event.pointerId);
  }

  onWheelPointerMove(event: PointerEvent): void {
    if (!this.wheelPointerActive || event.pointerId !== this.wheelPointerId) return;

    event.preventDefault();
    const dy = event.clientY - this.wheelPointerLastY;
    this.wheelPointerTravel += Math.abs(dy);
    this.wheelPointerDelta += dy;
    this.wheelPointerLastY = event.clientY;

    while (Math.abs(this.wheelPointerDelta) >= this.wheelPointerStep) {
      if (this.wheelPointerDelta > 0) {
        this.selectPrev();
        this.wheelPointerDelta -= this.wheelPointerStep;
      } else {
        this.selectNext();
        this.wheelPointerDelta += this.wheelPointerStep;
      }
    }
  }

  onWheelPointerEnd(event: PointerEvent): void {
    if (event.pointerId !== this.wheelPointerId) return;

    const target = event.currentTarget as HTMLElement;
    target.releasePointerCapture?.(event.pointerId);

    // Toque/clique sem arrasto = selecao direta: a roda rola ate a faixa.
    if (this.wheelPointerTravel < 10 && this.wheelPointerDownIndex !== null) {
      this.selectByClick(this.wheelPointerDownIndex);
    }

    this.wheelPointerActive = false;
    this.wheelPointerId = null;
    this.wheelPointerDelta = 0;
    this.wheelPointerTravel = 0;
    this.wheelPointerDownIndex = null;
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
        { name: 'name',        placeholder: 'Nome da playlist',   type: 'text'     },
        { name: 'description', placeholder: 'Descrição opcional', type: 'textarea' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Criar',
          handler: (data: { name?: string; description?: string }) => {
            const name = data.name?.trim();
            if (!name) return false;

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
    this.toastController
      .create({ message, duration: 1800, position: 'bottom' })
      .then((toast) => toast.present());
  }
}
