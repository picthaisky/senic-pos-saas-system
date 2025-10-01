export interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  customerId?: string;
  items: OrderItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  inventoryItemId: string;
  name: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

export enum OrderStatus {
  Pending = 'Pending',
  Processing = 'Processing',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
  Refunded = 'Refunded'
}

export enum PaymentMethod {
  Cash = 'Cash',
  CreditCard = 'CreditCard',
  DebitCard = 'DebitCard',
  QRCode = 'QRCode',
  BankTransfer = 'BankTransfer'
}

export interface CreateOrderDto {
  customerId?: string;
  items: CreateOrderItemDto[];
  discount?: number;
  paymentMethod: PaymentMethod;
}

export interface CreateOrderItemDto {
  inventoryItemId: string;
  quantity: number;
  discount?: number;
}

export interface CartItem extends OrderItem {
  imageUrl?: string;
  availableQuantity: number;
}
