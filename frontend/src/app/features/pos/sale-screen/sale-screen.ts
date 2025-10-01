import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule } from '@angular/material/dialog';
import { CartStore } from '../../../store/cart.store';
import { InventoryService } from '../../../core/services/inventory.service';
import { OrderService } from '../../../core/services/order.service';
import { PaymentMethod, CreateOrderDto } from '../../../core/models/order.model';
import { InventoryItem } from '../../../core/models/inventory.model';

@Component({
  selector: 'app-sale-screen',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatDividerModule,
    MatDialogModule
  ],
  templateUrl: './sale-screen.html',
  styleUrl: './sale-screen.scss'
})
export class SaleScreen {
  searchControl = new FormControl('');
  barcodeControl = new FormControl('');
  loading = signal(false);
  searchResults = signal<InventoryItem[]>([]);

  displayedColumns = ['name', 'quantity', 'price', 'discount', 'total', 'actions'];
  paymentMethods = Object.values(PaymentMethod);

  constructor(
    public cartStore: CartStore,
    private inventoryService: InventoryService,
    private orderService: OrderService
  ) {}

  onSearch(): void {
    const query = this.searchControl.value;
    if (!query) return;

    this.loading.set(true);
    this.inventoryService.getAll({ search: query, isActive: true }).subscribe({
      next: (items) => {
        this.searchResults.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onBarcodeSearch(): void {
    const barcode = this.barcodeControl.value;
    if (!barcode) return;

    this.loading.set(true);
    this.inventoryService.searchByBarcode(barcode).subscribe({
      next: (item) => {
        if (item) {
          this.addToCart(item);
        }
        this.barcodeControl.setValue('');
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  addToCart(item: InventoryItem): void {
    this.cartStore.addItem({
      inventoryItemId: item.id,
      name: item.name,
      quantity: 1,
      price: item.price,
      discount: 0,
      total: item.price,
      imageUrl: item.imageUrl,
      availableQuantity: item.quantity
    });
    this.searchResults.set([]);
    this.searchControl.setValue('');
  }

  removeFromCart(itemId: string): void {
    this.cartStore.removeItem(itemId);
  }

  updateQuantity(itemId: string, quantity: number): void {
    this.cartStore.updateItemQuantity(itemId, quantity);
  }

  updateDiscount(itemId: string, discount: number): void {
    this.cartStore.updateItemDiscount(itemId, discount);
  }

  clearCart(): void {
    if (confirm('Are you sure you want to clear the cart?')) {
      this.cartStore.clear();
    }
  }

  checkout(): void {
    const items = this.cartStore.cartItems();
    if (items.length === 0) return;

    this.loading.set(true);

    const orderDto: CreateOrderDto = {
      customerId: this.cartStore.selectedCustomerId() || undefined,
      items: items.map(item => ({
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        discount: item.discount
      })),
      discount: this.cartStore.discount(),
      paymentMethod: this.cartStore.paymentMethod()
    };

    this.orderService.create(orderDto).subscribe({
      next: (order) => {
        alert(`Order ${order.orderNumber} created successfully!`);
        this.cartStore.clear();
        this.loading.set(false);
      },
      error: (err) => {
        alert('Failed to create order: ' + (err.error?.message || 'Unknown error'));
        this.loading.set(false);
      }
    });
  }
}
