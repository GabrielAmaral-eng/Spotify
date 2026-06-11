import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { AuthService } from '../../core/services/auth.service';

type AuthMode = 'signin' | 'signup';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(-20px)' }))
      ])
    ])
  ]
})
export class LoginPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  mode: AuthMode = 'signin';
  email = '';
  password = '';
  loading = false;
  errorMessage = '';
  successMessage = '';

  // Estado para exibição de senha
  showPassword = false;
  showConfirmPopup = false;
  showSecurityAlert = false;
  private isErasingPassword = false;

  async ngOnInit(): Promise<void> {
    if (await this.authService.isAuthenticated()) {
      await this.router.navigateByUrl('/search');
    }
  }

  get title(): string {
    return this.mode === 'signin' ? 'Entrar' : 'Criar conta';
  }

  get submitLabel(): string {
    return this.mode === 'signin' ? 'Entrar' : 'Criar conta';
  }

  toggleMode(): void {
    this.mode = this.mode === 'signin' ? 'signup' : 'signin';
    this.errorMessage = '';
    this.successMessage = '';
  }

  /** Clique no ícone de olho */
  onEyeClick(): void {
    if (this.showPassword) {
      // Se já está mostrando, apenas oculta
      this.showPassword = false;
      return;
    }
    // Se não está mostrando, exibe o popup de confirmação
    this.showConfirmPopup = true;
  }

  /** Cancela a exibição da senha */
  cancelShowPassword(): void {
    this.showConfirmPopup = false;
  }

  /** Confirma a exibição da senha — mostra alerta e apaga a senha */
  confirmShowPassword(): void {
    this.showConfirmPopup = false;
    this.showPassword = true;

    // Exibe o alerta de segurança
    this.showSecurityAlert = true;

    // Inicia o apagamento gradual da senha
    this.erasePasswordGradually();

    // O alerta some depois de 7 segundos
    setTimeout(() => {
      this.showSecurityAlert = false;
    }, 7000);
  }

  /** Apaga a senha caractere por caractere */
  private erasePasswordGradually(): void {
    if (this.isErasingPassword || !this.password) return;
    this.isErasingPassword = true;

    const interval = setInterval(() => {
      if (this.password.length > 0) {
        this.password = this.password.slice(0, -1);
      } else {
        clearInterval(interval);
        this.isErasingPassword = false;
        this.showPassword = false;
      }
    }, 120);
  }

  async submit(): Promise<void> {
    const email = this.email.trim();

    if (!email || !this.password) {
      this.errorMessage = 'Preencha e-mail e senha.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      if (this.mode === 'signin') {
        const result = await this.authService.signIn(email, this.password);

        if (result.error) {
          this.errorMessage = this.translateError(result.error.message);
          return;
        }

        await this.router.navigateByUrl('/search');
        return;
      }

      const result = await this.authService.signUp(email, this.password);

      if (result.error) {
        this.errorMessage = this.translateError(result.error.message);
        return;
      }

      if (result.session) {
        await this.router.navigateByUrl('/search');
        return;
      }

      this.successMessage = 'Conta criada. Verifique seu e-mail antes de entrar.';
      this.mode = 'signin';
    } finally {
      this.loading = false;
    }
  }

  private translateError(message: string): string {
    const normalized = message.toLowerCase();

    if (normalized.includes('invalid login credentials')) {
      return 'E-mail ou senha inválidos.';
    }

    if (normalized.includes('password should be at least')) {
      return 'A senha precisa ter pelo menos 6 caracteres.';
    }

    if (normalized.includes('user already registered')) {
      return 'Já existe uma conta com esse e-mail.';
    }

    return message;
  }
}

