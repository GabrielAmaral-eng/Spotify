import { Component, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Observable, Subject, combineLatest, filter, map, startWith, takeUntil } from 'rxjs';
import { PlayerService } from './core/services/player.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnDestroy {
  private readonly playerService = inject(PlayerService);
  private readonly toastController = inject(ToastController);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  private readonly currentUrl$: Observable<string> = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map((event) => event.urlAfterRedirects),
    startWith(this.router.url)
  );

  // O mini-player aparece quando ha faixa tocando, exceto na busca, onde o
  // player completo docado assume o lugar dele.
  readonly showMiniPlayer$: Observable<boolean> = combineLatest([
    this.playerService.currentTrack$,
    this.currentUrl$
  ]).pipe(
    map(([track, url]) => track !== null && !url.startsWith('/search'))
  );

  constructor() {
    this.playerService.playbackMessage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        this.presentPlaybackMessage(message).catch(() => undefined);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async presentPlaybackMessage(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2600,
      position: 'bottom'
    });

    await toast.present();
  }
}
