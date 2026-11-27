// Shapes from docs/API_REFERENCE.md §3.

export interface InventoryItem {
  id: string
  sku: string
  name: string
  description: string | null
  barcode: string | null
  price: number
  cost: number
  quantity: number
  minimumStock: number
  category: string | null
  imageUrl: string | null
  isActive: boolean
  createdAt: string
}

export interface InventoryFilter {
  search?: string
  category?: string
  isActive?: boolean
  lowStock?: boolean
}

export interface CreateInventoryItem {
  sku: string
  name: string
  barcode: string | null
  category: string | null
  price: number
  cost: number
  quantity: number
  minimumStock: number
}

/** SKU and barcode are fixed once an item exists; the backend's update DTO has no such fields. */
export interface UpdateInventoryItem {
  name: string
  category: string | null
  price: number
  cost: number
  quantity: number
  minimumStock: number
  isActive: boolean
}

export const isLowStock = (item: InventoryItem) => item.quantity <= item.minimumStock
