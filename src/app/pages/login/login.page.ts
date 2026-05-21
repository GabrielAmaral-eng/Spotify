import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

type AuthMode = 'signin' | 'signup';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
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

  async ngOnInit(): Promise<void> {
    if (await this.authService.isAuthenticated()) {
      await this.router.navigateByUrl('/home');
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

        await this.router.navigateByUrl('/home');
        return;
      }

      const result = await this.authService.signUp(email, this.password);

      if (result.error) {
        this.errorMessage = this.translateError(result.error.message);
        return;
      }

      if (result.session) {
        await this.router.navigateByUrl('/home');
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
