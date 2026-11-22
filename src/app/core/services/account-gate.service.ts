import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from './auth.service';

/** Rota da tela de login/cadastro. */
export const AUTH_ROUTE = '/auth';

/**
 * Porteiro das acoes que exigem conta (curtir, playlists, biblioteca).
 * Ouvir musica e livre; quando o visitante tenta salvar algo, nenhuma chamada
 * a API e feita e um modal explica que a acao precisa de login, oferecendo ir
 * para /auth e voltar depois para a tela atual.
 */
@Injectable()
export class AccountGateService {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);

  /** Evita empilhar modais se o usuario clicar varias vezes. */
  private modalOpen = false;

  /**
   * True quando ha sessao; senao abre o modal de login e devolve false.
   * @param action descricao da acao, ex.: "Curtir músicas".
   */
  requireAccount(action = 'Essa ação'): boolean {
    if (this.authService.currentSession) {
      return true;
    }

    this.presentLoginModal(action).catch(() => undefined);
    return false;
  }

  /** Vai para o login guardando a rota atual para voltar depois. */
  goToLogin(returnUrl = this.router.url): Promise<boolean> {
    const isAuthPage = returnUrl.startsWith(AUTH_ROUTE) || returnUrl.startsWith('/login');
    const queryParams = returnUrl && !isAuthPage ? { returnUrl } : {};
    return this.router.navigate([AUTH_ROUTE], { queryParams });
  }

  private async presentLoginModal(action: string): Promise<void> {
    if (this.modalOpen) {
      return;
    }

    this.modalOpen = true;

    const alert = await this.alertController.create({
      cssClass: 'login-required-alert',
      header: 'Faça login para continuar',
      message: `${action} precisa de login. Ouvir músicas continua liberado sem conta.`,
      buttons: [
        { text: 'Agora não', role: 'cancel' },
        {
          text: 'Entrar',
          role: 'confirm',
          handler: () => {
            this.goToLogin().catch(() => undefined);
          }
        }
      ]
    });

    alert.onDidDismiss().then(() => {
      this.modalOpen = false;
    });

    await alert.present();
  }
}
