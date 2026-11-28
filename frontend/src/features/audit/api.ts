import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Shapes from docs/API_REFERENCE.md (audit trail).

export const AUDIT_ENTITY_TYPES = [
  'InventoryItem',
  'Customer',
  'Order',
  'User',
  'ShopSettings',
] as const
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

export type AuditValue = string | number | boolean | null

export interface AuditEntry {
  id: string
  createdAt: string
  userId: string
  /** Null when the account no longer exists. */
  userName: string | null
  action: 'Created' | 'Updated' | 'Deleted'
  entityType: AuditEntityType
  entityId: string
  /** Item name, bill number, customer name or user email, as it was at the time. */
  entityLabel: string
  changes: Record<string, { old: AuditValue; new: AuditValue }>
}

export interface AuditPage {
  items: AuditEntry[]
  total: number
  /** One-based. */
  page: number
  pageSize: number
}

export interface AuditQuery {
  entityType?: AuditEntityType
  page: number
  pageSize: number
}

export function useAuditLog(query: AuditQuery) {
  return useQuery({
    queryKey: ['audit', query],
    queryFn: () => api.get<AuditPage>('/audit-logs', { params: query }).then((r) => r.data),
    // Keep the current rows on screen while the next page loads.
    placeholderData: keepPreviousData,
  })
}
