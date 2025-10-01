export interface InventoryItem {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  cost: number;
  quantity: number;
  minQuantity: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInventoryItemDto {
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  cost: number;
  quantity: number;
  minQuantity: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface UpdateInventoryItemDto extends Partial<CreateInventoryItemDto> {
  id: string;
}

export interface InventoryFilter {
  search?: string;
  category?: string;
  isActive?: boolean;
  lowStock?: boolean;
}
