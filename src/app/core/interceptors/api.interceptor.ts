import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');
  private readonly authService = inject(AuthService);

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isBackendRequest =
      request.url.startsWith(this.apiUrl) || request.url.startsWith('/');

    if (!isBackendRequest) {
      return next.handle(request);
    }

    const url = request.url.startsWith('/') ? `${this.apiUrl}${request.url}` : request.url;

    return from(this.authService.getAccessToken()).pipe(
      switchMap((accessToken) => {
        const headers: Record<string, string> = {
          Accept: 'application/json'
        };

        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        return next.handle(
          request.clone({
            url,
            setHeaders: headers
          })
        );
      })
    );
  }
}
