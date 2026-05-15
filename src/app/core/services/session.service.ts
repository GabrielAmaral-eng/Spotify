import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface SessionResponse {
  id: string;
  token: string;
  createdAt: string;
}

@Injectable()
export class SessionService {
  private readonly storage = inject(Storage);
  private readonly tokenKey = 'session_token';
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');
  private readonly rawHttp = new HttpClient(inject(HttpBackend));
  private readonly tokenSubject = new BehaviorSubject<string | null>(null);
  private storageReady = this.storage.create().then(() => undefined);
  private pendingToken: Promise<string> | null = null;

  readonly token$: Observable<string | null> = this.tokenSubject.asObservable();

  async initialize(): Promise<string> {
    return this.getToken();
  }

  async getToken(): Promise<string> {
    const currentToken = this.tokenSubject.value;

    if (currentToken) {
      return currentToken;
    }

    if (!this.pendingToken) {
      this.pendingToken = this.resolveToken();
    }

    try {
      return await this.pendingToken;
    } finally {
      this.pendingToken = null;
    }
  }

  private async resolveToken(): Promise<string> {
    await this.storageReady;

    const storedToken = await this.storage.get(this.tokenKey);

    if (typeof storedToken === 'string' && storedToken.length > 0) {
      this.tokenSubject.next(storedToken);
      return storedToken;
    }

    const session = await firstValueFrom(
      this.rawHttp.post<SessionResponse>(`${this.apiUrl}/session`, {})
    );

    await this.storage.set(this.tokenKey, session.token);
    this.tokenSubject.next(session.token);

    return session.token;
  }
}
