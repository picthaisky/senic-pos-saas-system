import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fetchAllPages, type Page, type PageQuery } from '@/lib/paging'
import type {
  CreateCustomer,
  Customer,
  LoyaltyRequest,
  LoyaltyTransaction,
  UpdateCustomer,
} from './types'

export const customersApi = {
  /** One page of the active customers matching the search (name, email or phone). */
  page: (search: string | undefined, query: PageQuery) =>
    api.get<Page<Customer>>('/customers', { params: { search, ...query } }).then((r) => r.data),

  /** Every active customer, read page by page: for the till's customer picker and exports. */
  list: (search?: string, sort?: string) =>
    fetchAllPages((query) => customersApi.page(search, query), sort),

  create: (customer: CreateCustomer) =>
    api.post<Customer>('/customers', customer).then((r) => r.data),

  /** Rejects with 409 when another customer of the shop already has that email. */
  update: (id: string, changes: UpdateCustomer) =>
    api.put<Customer>(`/customers/${id}`, changes).then((r) => r.data),

  remove: (id: string) => api.delete<void>(`/customers/${id}`),

  loyaltyHistory: (id: string) =>
    api.get<LoyaltyTransaction[]>(`/customers/${id}/loyalty`).then((r) => r.data),

  /** `kind` picks POST /loyalty/earn or /loyalty/redeem; redeem rejects with 409 if short. */
  changePoints: (id: string, kind: 'earn' | 'redeem', request: LoyaltyRequest) =>
    api.post<Customer>(`/customers/${id}/loyalty/${kind}`, request).then((r) => r.data),
}

export const CUSTOMERS_KEY = ['customers'] as const

export function useCustomers() {
  return useQuery({ queryKey: [...CUSTOMERS_KEY, 'list'], queryFn: () => customersApi.list() })
}

export function useCustomersPage(search: string | undefined, query: PageQuery) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, 'page', search, query],
    queryFn: () => customersApi.page(search, query),
    placeholderData: keepPreviousData,
  })
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

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; changes: UpdateCustomer }) =>
      customersApi.update(input.id, input.changes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY })
      void queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
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
