// Shapes from docs/API_REFERENCE.md §4.

export interface Customer {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string | null
  address: string | null
  dateOfBirth: string | null
  loyaltyPoints: number
  isActive: boolean
  createdAt: string
}

export interface CreateCustomer {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
}

export interface LoyaltyTransaction {
  id: string
  customerId: string
  type: 'Earned' | 'Redeemed'
  points: number
  orderId: string | null
  description: string
  createdAt: string
}

export interface LoyaltyRequest {
  points: number
  description: string
}
