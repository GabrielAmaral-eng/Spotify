import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { AccountGateService } from '../../core/services/account-gate.service';
import { AuthService } from '../../core/services/auth.service';
import { PlaylistService } from '../../core/services/playlist.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly accountGate = inject(AccountGateService);
  private readonly playlistService = inject(PlaylistService);
  private readonly toastController = inject(ToastController);
  private readonly destroy$ = new Subject<void>();

  readonly playlists$ = this.playlistService.playlists$;
  readonly favorites$ = this.playlistService.favorites$;
  readonly isAuthenticated$ = this.authService.isAuthenticated$;

  ngOnInit(): void {
    // Playlists/favoritos so carregam com sessao (e somem ao deslogar).
    this.playlistService.syncWithSession().pipe(takeUntil(this.destroy$)).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Botao da conta: com sessao, sai sem parar a musica; sem sessao, leva ao
   * login e volta para ca depois.
   */
  async onAccountButton(): Promise<void> {
    if (!this.authService.currentSession) {
      await this.accountGate.goToLogin();
      return;
    }

    try {
      await this.authService.signOut();
      this.presentToast('Você saiu da sua conta.');
    } catch {
      this.presentToast('Não foi possível sair agora.');
    }
  }

  private presentToast(message: string): void {
    this.toastController
      .create({ message, duration: 1800, position: 'bottom' })
      .then((toast) => toast.present());
  }
}
