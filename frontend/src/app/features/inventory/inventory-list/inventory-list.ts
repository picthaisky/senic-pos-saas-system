import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryItem, CreateInventoryItemDto, UpdateInventoryItemDto } from '../../../core/models/inventory.model';

@Component({
  selector: 'app-inventory-list',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatChipsModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './inventory-list.html',
  styleUrl: './inventory-list.scss'
})
export class InventoryList implements OnInit {
  displayedColumns: string[] = ['name', 'sku', 'barcode', 'category', 'price', 'quantity', 'status', 'actions'];
  dataSource = new MatTableDataSource<InventoryItem>([]);
  
  loading = signal(false);
  searchTerm = signal('');
  selectedCategory = signal<string | null>(null);
  showLowStock = signal(false);
  
  pageSize = 10;
  pageIndex = 0;
  totalItems = 0;

  categories = ['Electronics', 'Food', 'Beverages', 'Clothing', 'Accessories', 'Other'];

  constructor(
    private inventoryService: InventoryService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadInventory();
  }

  loadInventory(): void {
    this.loading.set(true);
    
    const filter = {
      search: this.searchTerm() || undefined,
      category: this.selectedCategory() || undefined,
      lowStock: this.showLowStock() || undefined
    };

    this.inventoryService.getAll(filter).subscribe({
      next: (items) => {
        this.dataSource.data = items;
        this.totalItems = items.length;
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.pageIndex = 0;
    this.loadInventory();
  }

  onCategoryChange(category: string | null): void {
    this.selectedCategory.set(category);
    this.pageIndex = 0;
    this.loadInventory();
  }

  toggleLowStock(): void {
    this.showLowStock.update(value => !value);
    this.pageIndex = 0;
    this.loadInventory();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  onSort(sort: Sort): void {
    const data = this.dataSource.data.slice();
    if (!sort.active || sort.direction === '') {
      this.dataSource.data = data;
      return;
    }

    this.dataSource.data = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'name': return this.compare(a.name, b.name, isAsc);
        case 'price': return this.compare(a.price, b.price, isAsc);
        case 'quantity': return this.compare(a.quantity, b.quantity, isAsc);
        default: return 0;
      }
    });
  }

  private compare(a: number | string, b: number | string, isAsc: boolean): number {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }

  editItem(item: InventoryItem): void {
    // Open dialog for editing (simplified version)
    const newQuantity = prompt(`Update quantity for ${item.name}:`, item.quantity.toString());
    if (newQuantity) {
      const dto: UpdateInventoryItemDto = {
        id: item.id,
        quantity: parseInt(newQuantity)
      };
      this.inventoryService.update(dto).subscribe({
        next: () => this.loadInventory(),
        error: (err) => alert('Failed to update: ' + err.message)
      });
    }
  }

  deleteItem(item: InventoryItem): void {
    if (confirm(`Are you sure you want to delete ${item.name}?`)) {
      this.inventoryService.delete(item.id).subscribe({
        next: () => this.loadInventory(),
        error: (err) => alert('Failed to delete: ' + err.message)
      });
    }
  }

  addNewItem(): void {
    // Simplified add item (in real app would open a dialog)
    alert('Add new item dialog would open here');
  }

  exportData(): void {
    alert('Export functionality would be implemented here');
  }

  isLowStock(item: InventoryItem): boolean {
    return item.quantity <= item.minQuantity;
  }
}
