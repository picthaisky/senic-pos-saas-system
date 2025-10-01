export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  loyaltyPoints: number;
  totalSpent: number;
  visitCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerDto {
  name: string;
  email?: string;
  phone?: string;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {
  id: string;
}

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  points: number;
  type: 'EARNED' | 'REDEEMED';
  orderId?: string;
  description: string;
  createdAt: Date;
}
