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
import { Router } from '@angular/router';
import { PlayerService } from '../../core/services/player.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { AudiusService } from '../../core/services/audius.service';
import { AuthService } from '../../core/services/auth.service';
import { Track } from '../../shared/models/track.model';
import { Playlist } from '../../shared/models/playlist.model';

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
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
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

  /**
   * Posicao visual continua da roda (float). Persegue selectedSongIndex
   * quadro a quadro para que os itens deslizem pelo arco — como uma roda
   * girando — em vez de cortarem em linha reta (corda) ate o centro.
   * A selecao em si continua governada por selectedSongIndex (inteiro).
   */
  private wheelDisplayIndex = 0;
  private wheelAnimationFrame: number | null = null;
  private wheelLastFrameTime = 0;
  /** Constante de tempo do amortecimento (ms): menor = giro mais rapido. */
  private readonly wheelTau = 100;
  /**
   * Minimo de faixas para a roda girar de forma infinita (com emenda). O arco
   * visivel comporta 7 itens distintos (offsets -3..3, ate o fade em 3.2); com
   * menos que isso o wrap faria a mesma faixa reaparecer duplicada do outro
   * lado, entao abaixo deste limite a roda vira uma lista finita (com batente).
   */
  private readonly wheelLoopThreshold = 7;

  /** A roda so gira infinitamente quando ha faixas suficientes para o arco. */
  private get wheelLoops(): boolean {
    return this.wheelTracks.length >= this.wheelLoopThreshold;
  }

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
    if (this.wheelAnimationFrame !== null) {
      cancelAnimationFrame(this.wheelAnimationFrame);
      this.wheelAnimationFrame = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Abre ou fecha o painel de playlists */
  togglePlaylists(event: Event): void {
    // Impede que o clique no botão chegue ao listener de "clicar fora" do
    // painel, que senão fecharia o painel no mesmo clique que o abre/fecha.
    event.stopPropagation();
    this.showPlaylists = !this.showPlaylists;
  }

  async logout(): Promise<void> {
    this.playerService.stop();
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }

  onSelectPlaylist(playlist: Playlist): void {
    this.showPlaylists = false;
    this.clearSearch();
    this.wheelTracks = playlist.tracks || [];
    this.selectedSongIndex = 0;
    this.snapWheel();

    if (this.wheelTracks.length > 0) {
      this.playWheelSelection();
    } else {
      this.presentToast('Esta playlist não possui músicas.');
    }
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
    this.snapWheel();
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
    const allPlaylists = this.playlistService.playlistsSnapshot;
    const playlists = allPlaylists.filter(
      (playlist) => !playlist.tracks.some((t) => t.id === track.id)
    );

    if (allPlaylists.length === 0 || playlists.length === 0) {
      if (allPlaylists.length > 0 && playlists.length === 0) {
        this.presentToast('Essa música já está em todas as suas playlists.');
        return;
      }
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
    if (length === 0) return 0;
    // Usa a posicao visual continua (nao o indice inteiro) para que os itens
    // sejam recalculados sobre o arco a cada quadro durante o giro.
    let offset = songIdx - this.wheelDisplayIndex;
    // So reposiciona pelo caminho mais curto (emenda) quando a roda e infinita;
    // com poucas faixas isso duplicaria itens no outro lado do arco.
    if (this.wheelLoops) {
      while (offset > length / 2) offset -= length;
      while (offset <= -length / 2) offset += length;
    }
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

  /**
   * Faz a roda deslizar suavemente ate a faixa selecionada, seguindo o arco.
   * A cada quadro aproxima wheelDisplayIndex de selectedSongIndex; como os
   * transforms sao recalculados pelo arco em getItemTransform, os itens
   * acompanham a curva (sem o "puxao" para o centro da interpolacao em corda),
   * tanto em um passo quanto em varios passos seguidos (scroll rapido/mobile).
   */
  private animateWheel(): void {
    if (this.wheelAnimationFrame !== null) return;

    const step = (timestamp: number): void => {
      const length = this.wheelTracks.length;
      if (length === 0) {
        this.wheelAnimationFrame = null;
        return;
      }

      const dt = this.wheelLastFrameTime
        ? Math.min(64, timestamp - this.wheelLastFrameTime)
        : 16;
      this.wheelLastFrameTime = timestamp;

      // Alvo: a copia de selectedSongIndex mais proxima da posicao atual, para
      // girar pelo caminho mais curto mesmo cruzando a emenda da roda infinita.
      // Numa lista finita nao ha emenda: vai direto ao indice selecionado.
      let target = this.selectedSongIndex;
      if (this.wheelLoops) {
        while (target - this.wheelDisplayIndex > length / 2) target -= length;
        while (target - this.wheelDisplayIndex < -length / 2) target += length;
      }

      // Amortecimento exponencial independente da taxa de quadros (60/120Hz).
      const k = 1 - Math.exp(-dt / this.wheelTau);
      this.wheelDisplayIndex += (target - this.wheelDisplayIndex) * k;

      if (Math.abs(target - this.wheelDisplayIndex) < 0.001) {
        this.wheelDisplayIndex = ((target % length) + length) % length;
        this.wheelAnimationFrame = null;
        this.wheelLastFrameTime = 0;
        return;
      }

      this.wheelAnimationFrame = requestAnimationFrame(step);
    };

    this.wheelLastFrameTime = 0;
    this.wheelAnimationFrame = requestAnimationFrame(step);
  }

  /** Posiciona a roda instantaneamente (troca de lista/playlist, sem giro). */
  private snapWheel(): void {
    if (this.wheelAnimationFrame !== null) {
      cancelAnimationFrame(this.wheelAnimationFrame);
      this.wheelAnimationFrame = null;
    }
    this.wheelLastFrameTime = 0;
    this.wheelDisplayIndex = this.selectedSongIndex;
  }

  /** Seleciona ao clicar numa faixa visivel: a roda rola ate o centro e toca. */
  private selectByClick(index: number): void {
    if (index < 0 || index >= this.wheelTracks.length || index === this.selectedSongIndex) {
      return;
    }

    this.selectedSongIndex = index;
    this.animateWheel();
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
    if (this.wheelLoops) {
      this.selectedSongIndex = (this.selectedSongIndex - 1 + length) % length;
    } else {
      // Lista finita: batente no topo, sem dar a volta.
      if (this.selectedSongIndex === 0) return;
      this.selectedSongIndex -= 1;
    }
    this.animateWheel();
    this.wheelSelection$.next();
  }

  selectNext(): void {
    const length = this.wheelTracks.length;
    if (length === 0) return;
    if (this.wheelLoops) {
      this.selectedSongIndex = (this.selectedSongIndex + 1) % length;
    } else {
      // Lista finita: batente no fim, sem dar a volta.
      if (this.selectedSongIndex === length - 1) return;
      this.selectedSongIndex += 1;
    }
    this.animateWheel();
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
