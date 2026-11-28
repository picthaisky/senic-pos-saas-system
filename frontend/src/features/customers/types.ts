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

/** PUT /customers/{id}: a field left out stays as it is; an empty string clears it. */
export type UpdateCustomer = Partial<
  Record<'firstName' | 'lastName' | 'email' | 'phone' | 'address', string>
>

export interface LoyaltyTransaction {
  id: string
  customerId: string
  /**
   * 'Reversed' = points taken back because the bill that earned them was cancelled;
   * 'Returned' = points given back because the bill they were used on was cancelled.
   */
  type: 'Earned' | 'Redeemed' | 'Reversed' | 'Returned'
  points: number
  orderId: string | null
  description: string
  createdAt: string
}

export interface LoyaltyRequest {
  points: number
  description: string
}
