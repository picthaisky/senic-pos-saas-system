import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatTableModule } from '@angular/material/table';

interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  lowStockItems: number;
}

interface SalesData {
  date: string;
  sales: number;
  orders: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatGridListModule,
    MatTableModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  stats = signal<DashboardStats>({
    totalSales: 0,
    totalOrders: 0,
    totalCustomers: 0,
    lowStockItems: 0
  });

  salesData = signal<SalesData[]>([]);
  topProducts = signal<TopProduct[]>([]);
  loading = signal(false);

  displayedColumns = ['name', 'quantity', 'revenue'];

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading.set(true);

    // Simulate API call with mock data
    setTimeout(() => {
      this.stats.set({
        totalSales: 125750.50,
        totalOrders: 248,
        totalCustomers: 156,
        lowStockItems: 12
      });

      this.salesData.set([
        { date: '2024-01', sales: 25000, orders: 50 },
        { date: '2024-02', sales: 32000, orders: 65 },
        { date: '2024-03', sales: 28000, orders: 58 },
        { date: '2024-04', sales: 40750.50, orders: 75 }
      ]);

      this.topProducts.set([
        { name: 'Product A', quantity: 150, revenue: 45000 },
        { name: 'Product B', quantity: 120, revenue: 36000 },
        { name: 'Product C', quantity: 98, revenue: 29400 },
        { name: 'Product D', quantity: 87, revenue: 26100 },
        { name: 'Product E', quantity: 65, revenue: 19500 }
      ]);

      this.loading.set(false);
    }, 1000);
  }

  getMaxSales(): number {
    return Math.max(...this.salesData().map(d => d.sales));
  }

  getSalesPercentage(sales: number): number {
    const max = this.getMaxSales();
    return max > 0 ? (sales / max) * 100 : 0;
  }

  refreshData(): void {
    this.loadDashboardData();
  }
}
