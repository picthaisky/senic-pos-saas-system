import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CreateUser, ManagedUser, UpdateUser } from './types'

export const usersApi = {
  list: () => api.get<ManagedUser[]>('/users').then((r) => r.data),

  create: (user: CreateUser) => api.post<ManagedUser>('/users', user).then((r) => r.data),

  /** 409 when it would leave the shop without an active owner, or change the caller's own access. */
  update: (id: string, changes: UpdateUser) =>
    api.put<ManagedUser>(`/users/${id}`, changes).then((r) => r.data),

  /** Also signs the user out everywhere. */
  resetPassword: (id: string, newPassword: string) =>
    api.post<void>(`/users/${id}/reset-password`, { newPassword }),
}

export const USERS_KEY = ['users'] as const

export function useUsers() {
  return useQuery({ queryKey: [...USERS_KEY, 'list'], queryFn: usersApi.list })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; changes: UpdateUser }) =>
      usersApi.update(input.id, input.changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { id: string; newPassword: string }) =>
      usersApi.resetPassword(input.id, input.newPassword),
  })
}
