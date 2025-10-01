import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User, LoginRequest, LoginResponse, AuthToken } from '../models/auth.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/api/auth`;
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  // Signals for reactive state management
  private currentUserSignal = signal<User | null>(this.getUserFromStorage());
  private isAuthenticatedSignal = computed(() => !!this.currentUserSignal());

  // Public readonly signals
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = this.isAuthenticatedSignal;

  constructor(private http: HttpClient) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, request).pipe(
      tap(response => {
        this.setAuthData(response.user, response.token);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSignal.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  hasRole(role: string): boolean {
    const user = this.currentUserSignal();
    return user?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.currentUserSignal();
    return user ? roles.includes(user.role) : false;
  }

  private setAuthData(user: User, token: AuthToken): void {
    localStorage.setItem(this.TOKEN_KEY, token.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSignal.set(user);
  }

  private getUserFromStorage(): User | null {
    const userJson = localStorage.getItem(this.USER_KEY);
    if (!userJson) return null;
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  }
}
