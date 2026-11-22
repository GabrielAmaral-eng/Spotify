import { Component, ElementRef, HostBinding, HostListener, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { Observable, Subject, of, switchMap, takeUntil } from 'rxjs';
import { AccountGateService } from '../../core/services/account-gate.service';
import { DownloadService } from '../../core/services/download.service';
import { PlayerService } from '../../core/services/player.service';
import { PlaylistService } from '../../core/services/playlist.service';
import { SharedModule } from '../../shared/shared.module';
import { Track } from '../../shared/models/track.model';

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss'],
  standalone: true,
  imports: [SharedModule, RouterModule],
})
export class PlayerComponent implements OnInit, OnDestroy {
  private readonly playerService = inject(PlayerService);
  private readonly playlistService = inject(PlaylistService);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly toastController = inject(ToastController);
  private readonly accountGate = inject(AccountGateService);
  private readonly downloadService = inject(DownloadService);
  private readonly destroy$ = new Subject<void>();

  /** Versao compacta para encaixe na pagina de busca. */
  @Input() @HostBinding('class.embedded') embedded = false;

  @ViewChild('volumeControl') private volumeControl?: ElementRef<HTMLElement>;

  readonly currentTrack$ = this.playerService.currentTrack$;
  readonly isPlaying$ = this.playerService.isPlaying$;
  readonly isLoading$ = this.playerService.isLoading$;
  readonly progress$ = this.playerService.progress$;
  readonly favoriteIds$ = this.playlistService.favoriteIds$;
  readonly downloadState$ = this.downloadService.state$;

  /**
   * A faixa atual pode ser baixada? Faixas da busca ja sabem; faixas salvas
   * (favoritos/playlists) sao consultadas no backend uma vez por faixa.
   */
  readonly downloadable$: Observable<boolean> = this.currentTrack$.pipe(
    switchMap((track) => (track ? this.downloadService.isDownloadable(track) : of(false)))
  );

  /** Volume em porcentagem (0–100) e visibilidade do slider. */
  volume = this.playerService.currentVolume;
  volumeOpen = false;
  private volumeDragging = false;

  ngOnInit(): void {
    // Playlists/favoritos so carregam com sessao (e somem ao deslogar).
    this.playlistService.syncWithSession().pipe(takeUntil(this.destroy$)).subscribe();
    this.volume = this.playerService.currentVolume;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggle(): void {
    this.playerService.toggle();
  }

  /** Botao da esquerda: volta uma faixa (uma para cima na roda). */
  previous(): void {
    this.playerService.requestPrevious();
  }

  /** Botao da direita: avanca uma faixa (uma para baixo na roda). */
  next(): void {
    this.playerService.requestNext();
  }

  toggleVolume(event: Event): void {
    event.stopPropagation();
    this.volumeOpen = !this.volumeOpen;
  }

  /** Fecha o slider ao clicar fora do controle de volume. */
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.volumeOpen) {
      return;
    }

    const control = this.volumeControl?.nativeElement;
    if (control && !control.contains(event.target as Node)) {
      this.volumeOpen = false;
    }
  }

  onVolumePointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.volumeDragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.updateVolumeFromEvent(event);
  }

  onVolumePointerMove(event: PointerEvent): void {
    if (!this.volumeDragging) {
      return;
    }
    this.updateVolumeFromEvent(event);
  }

  onVolumePointerEnd(event: PointerEvent): void {
    this.volumeDragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  /** Converte a posicao vertical do ponteiro em volume (0–100, cima = mais). */
  private updateVolumeFromEvent(event: PointerEvent): void {
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const percent = ((rect.bottom - event.clientY) / rect.height) * 100;
    this.volume = Math.min(100, Math.max(0, Math.round(percent)));
    this.playerService.setVolume(this.volume);
  }

  seek(event: Event): void {
    const value = (event as CustomEvent<{ value: number | number[] }>).detail.value;
    const progress = Array.isArray(value) ? value[0] : value;
    this.playerService.seekToPercent(progress);
  }

  progressToSeconds(progress: number | null | undefined, duration: number | null | undefined): number {
    const normalizedProgress = Math.min(100, Math.max(0, progress ?? 0));
    return ((duration ?? 0) * normalizedProgress) / 100;
  }

  toggleFavorite(track: Track): void {
    if (!this.accountGate.requireAccount('Curtir músicas')) {
      return;
    }

    this.playlistService.toggleFavorite(track).subscribe({
      next: () => undefined,
      error: () => this.presentToast('Não foi possível atualizar os favoritos.')
    });
  }

  /** Baixar nao exige conta. */
  download(track: Track): void {
    this.downloadService.download(track).catch(() => undefined);
  }

  async addToPlaylist(track: Track): Promise<void> {
    if (!this.accountGate.requireAccount('Adicionar músicas a playlists')) {
      return;
    }

    const playlists = this.playlistService.playlistsSnapshot;

    if (playlists.length === 0) {
      this.presentToast('Crie uma playlist antes de adicionar músicas.');
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
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  private presentToast(message: string): void {
    this.toastController.create({
      message,
      duration: 1800,
      position: 'bottom'
    }).then((toast) => toast.present());
  }
}
