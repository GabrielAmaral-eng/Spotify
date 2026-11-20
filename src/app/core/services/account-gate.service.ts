import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from './auth.service';

/**
 * Porteiro das acoes que exigem conta (curtir, playlists, biblioteca).
 * Ouvir musica e livre; quando o visitante tenta salvar algo, nenhuma chamada
 * a API e feita e um toast oferece ir para o login, voltando depois para a
 * tela atual.
 */
@Injectable()
export class AccountGateService {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);

  /** True quando ha sessao; senao mostra o convite para entrar e devolve false. */
  requireAccount(message = 'Entre para salvar suas músicas'): boolean {
    if (this.authService.currentSession) {
      return true;
    }

    this.presentLoginToast(message).catch(() => undefined);
    return false;
  }

  /** Vai para o login guardando a rota atual para voltar depois. */
  goToLogin(returnUrl = this.router.url): Promise<boolean> {
    const queryParams = returnUrl && !returnUrl.startsWith('/login') ? { returnUrl } : {};
    return this.router.navigate(['/login'], { queryParams });
  }

  private async presentLoginToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3500,
      position: 'bottom',
      buttons: [
        {
          text: 'Entrar',
          handler: () => {
            this.goToLogin().catch(() => undefined);
          }
        }
      ]
    });

    await toast.present();
  }
}
