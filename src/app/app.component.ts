import { Component, OnDestroy, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
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
  private readonly destroy$ = new Subject<void>();

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
