import { Injectable, inject } from '@angular/core';
import { AuthError, Session, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';

export interface AuthResult {
  error: AuthError | null;
  session: Session | null;
  user: User | null;
}

@Injectable()
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly sessionSubject = new BehaviorSubject<Session | null>(null);
  private readonly ready = this.bootstrap();

  readonly session$: Observable<Session | null> = this.sessionSubject.asObservable();

  constructor() {
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.sessionSubject.next(session);
    });
  }

  get currentSession(): Session | null {
    return this.sessionSubject.value;
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!error) {
      this.sessionSubject.next(data.session);
    }

    return {
      error,
      session: data.session,
      user: data.user
    };
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password
    });

    if (!error) {
      this.sessionSubject.next(data.session);
    }

    return {
      error,
      session: data.session,
      user: data.user
    };
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      throw error;
    }

    this.sessionSubject.next(null);
  }

  async isAuthenticated(): Promise<boolean> {
    await this.ready;
    return Boolean(this.sessionSubject.value);
  }

  async getAccessToken(): Promise<string | null> {
    await this.ready;
    return this.sessionSubject.value?.access_token ?? null;
  }

  async requireUser(): Promise<User> {
    await this.ready;
    const user = this.sessionSubject.value?.user;

    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    return user;
  }

  private async bootstrap(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    this.sessionSubject.next(data.session);
  }
}
