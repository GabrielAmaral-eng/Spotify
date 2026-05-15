import { Injectable, inject } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable, from, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SessionService } from '../services/session.service';

@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');
  private readonly sessionService = inject(SessionService);

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isBackendRequest =
      request.url.startsWith(this.apiUrl) || request.url.startsWith('/');

    if (!isBackendRequest) {
      return next.handle(request);
    }

    const url = request.url.startsWith('/') ? `${this.apiUrl}${request.url}` : request.url;
    const isSessionRequest = url.endsWith('/session');

    if (isSessionRequest) {
      return next.handle(
        request.clone({
          url,
          setHeaders: {
            Accept: 'application/json'
          }
        })
      );
    }

    return from(this.sessionService.getToken()).pipe(
      catchError(() => of(null)),
      switchMap((token) => {
        const headers: Record<string, string> = {
          Accept: 'application/json'
        };

        if (token) {
          headers['X-Session-Token'] = token;
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
