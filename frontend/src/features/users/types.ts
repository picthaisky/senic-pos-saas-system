// Shapes from docs/API_REFERENCE.md §2 (user management).
import type { Role } from '@/stores/auth'

export interface ManagedUser {
  id: string
  email: string
  name: string
  role: Role
  isActive: boolean
  createdAt: string
}

export interface CreateUser {
  email: string
  name: string
  role: Role
  password: string
}

/** Only the fields that are sent change. */
export interface UpdateUser {
  name?: string
  role?: Role
  isActive?: boolean
}

/** The API rejects shorter passwords with 400. */
export const MIN_NEW_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128
