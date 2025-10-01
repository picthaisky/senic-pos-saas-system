import { Injectable, signal, computed } from '@angular/core';
import { CartItem, PaymentMethod } from '../core/models/order.model';

@Injectable({
  providedIn: 'root'
})
export class CartStore {
  // State
  private cartItemsSignal = signal<CartItem[]>([]);
  private discountSignal = signal<number>(0);
  private selectedCustomerIdSignal = signal<string | null>(null);
  private paymentMethodSignal = signal<PaymentMethod>(PaymentMethod.Cash);

  // Computed values
  readonly cartItems = this.cartItemsSignal.asReadonly();
  readonly discount = this.discountSignal.asReadonly();
  readonly selectedCustomerId = this.selectedCustomerIdSignal.asReadonly();
  readonly paymentMethod = this.paymentMethodSignal.asReadonly();

  readonly subtotal = computed(() => {
    return this.cartItemsSignal().reduce((sum, item) => sum + item.total, 0);
  });

  readonly taxRate = computed(() => 0.07); // 7% tax

  readonly taxAmount = computed(() => {
    const subtotal = this.subtotal();
    const discount = this.discountSignal();
    return (subtotal - discount) * this.taxRate();
  });

  readonly total = computed(() => {
    return this.subtotal() - this.discountSignal() + this.taxAmount();
  });

  readonly itemCount = computed(() => {
    return this.cartItemsSignal().reduce((sum, item) => sum + item.quantity, 0);
  });

  // Actions
  addItem(item: CartItem): void {
    const existing = this.cartItemsSignal().find(
      i => i.inventoryItemId === item.inventoryItemId
    );

    if (existing) {
      this.updateItemQuantity(item.inventoryItemId, existing.quantity + item.quantity);
    } else {
      this.cartItemsSignal.update(items => [...items, item]);
    }
  }

  removeItem(inventoryItemId: string): void {
    this.cartItemsSignal.update(items => 
      items.filter(item => item.inventoryItemId !== inventoryItemId)
    );
  }

  updateItemQuantity(inventoryItemId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(inventoryItemId);
      return;
    }

    this.cartItemsSignal.update(items =>
      items.map(item => {
        if (item.inventoryItemId === inventoryItemId) {
          const total = item.price * quantity - item.discount;
          return { ...item, quantity, total };
        }
        return item;
      })
    );
  }

  updateItemDiscount(inventoryItemId: string, discount: number): void {
    this.cartItemsSignal.update(items =>
      items.map(item => {
        if (item.inventoryItemId === inventoryItemId) {
          const total = item.price * item.quantity - discount;
          return { ...item, discount, total };
        }
        return item;
      })
    );
  }

  setDiscount(discount: number): void {
    this.discountSignal.set(discount);
  }

  setCustomer(customerId: string | null): void {
    this.selectedCustomerIdSignal.set(customerId);
  }

  setPaymentMethod(method: PaymentMethod): void {
    this.paymentMethodSignal.set(method);
  }

  clear(): void {
    this.cartItemsSignal.set([]);
    this.discountSignal.set(0);
    this.selectedCustomerIdSignal.set(null);
    this.paymentMethodSignal.set(PaymentMethod.Cash);
  }
}
