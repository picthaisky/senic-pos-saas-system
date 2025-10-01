export interface User {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
  name: string;
}

export enum UserRole {
  Admin = 'Admin',
  Owner = 'Owner',
  Cashier = 'Cashier',
  Viewer = 'Viewer'
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  refreshToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantId: string;
}

export interface LoginResponse {
  user: User;
  token: AuthToken;
}
