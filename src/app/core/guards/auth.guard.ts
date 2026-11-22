import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AUTH_ROUTE } from '../services/account-gate.service';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (await authService.isAuthenticated()) {
    return true;
  }

  // Leva a rota pedida para o login, que devolve o usuario para ela depois.
  return router.createUrlTree([AUTH_ROUTE], { queryParams: { returnUrl: state.url } });
};
