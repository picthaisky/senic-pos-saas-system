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

/** Answer of POST /inventory/import (docs/API_REFERENCE.md, "นำเข้าสินค้าจากไฟล์"). */
export interface ItemImportResult {
  totalRows: number
  /** Rows whose SKU is new. */
  toCreate: number
  /** Rows whose SKU exists: the item's details are replaced, its stock is not. */
  toUpdate: number
  /** Of `toUpdate`, the rows whose quantity differs from the stock on hand. */
  stockNotChanged: number
  /** True when the items were saved; false for a check, or when a row is wrong. */
  applied: boolean
  errorCount: number
  /** The first 200 errors, in the order of the file. */
  errors: ItemImportError[]
}

export interface ItemImportError {
  /** The row as numbered in a spreadsheet. */
  row: number
  /** A server error code; its sentence is in the "errors" section of the locale files. */
  code: string
  params: Record<string, string | number | null>
  message: string
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
