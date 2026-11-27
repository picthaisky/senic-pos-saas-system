import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CreateCustomer, Customer, LoyaltyRequest, LoyaltyTransaction } from './types'

export const customersApi = {
  list: () => api.get<Customer[]>('/customers').then((r) => r.data),

  create: (customer: CreateCustomer) =>
    api.post<Customer>('/customers', customer).then((r) => r.data),

  remove: (id: string) => api.delete<void>(`/customers/${id}`),

  loyaltyHistory: (id: string) =>
    api.get<LoyaltyTransaction[]>(`/customers/${id}/loyalty`).then((r) => r.data),

  /** `kind` picks POST /loyalty/earn or /loyalty/redeem; redeem rejects with 409 if short. */
  changePoints: (id: string, kind: 'earn' | 'redeem', request: LoyaltyRequest) =>
    api.post<Customer>(`/customers/${id}/loyalty/${kind}`, request).then((r) => r.data),
}

export const CUSTOMERS_KEY = ['customers'] as const

export function useCustomers() {
  return useQuery({ queryKey: [...CUSTOMERS_KEY, 'list'], queryFn: customersApi.list })
}

export function useLoyaltyHistory(customerId: string) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, 'loyalty', customerId],
    queryFn: () => customersApi.loyaltyHistory(customerId),
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: customersApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}

export function useChangePoints(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { kind: 'earn' | 'redeem'; request: LoyaltyRequest }) =>
      customersApi.changePoints(customerId, input.kind, input.request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}
