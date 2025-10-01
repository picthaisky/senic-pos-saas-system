import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CustomerService } from '../../../core/services/customer.service';
import { Customer, CreateCustomerDto, LoyaltyTransaction } from '../../../core/models/customer.model';

@Component({
  selector: 'app-customer-loyalty',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    MatChipsModule,
    MatExpansionModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './customer-loyalty.html',
  styleUrl: './customer-loyalty.scss'
})
export class CustomerLoyalty implements OnInit {
  customerForm: FormGroup;
  customers = signal<Customer[]>([]);
  selectedCustomer = signal<Customer | null>(null);
  transactions = signal<LoyaltyTransaction[]>([]);
  loading = signal(false);

  displayedColumns = ['name', 'email', 'phone', 'loyaltyPoints', 'totalSpent', 'visitCount', 'actions'];
  dataSource = new MatTableDataSource<Customer>([]);

  constructor(
    private fb: FormBuilder,
    private customerService: CustomerService
  ) {
    this.customerForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.email]],
      phone: ['', [Validators.pattern(/^\d{10}$/)]]
    });
  }

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading.set(true);
    this.customerService.getAll().subscribe({
      next: (customers) => {
        this.customers.set(customers);
        this.dataSource.data = customers;
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSubmit(): void {
    if (this.customerForm.invalid) return;

    this.loading.set(true);
    const dto: CreateCustomerDto = this.customerForm.value;

    this.customerService.create(dto).subscribe({
      next: (customer) => {
        this.loadCustomers();
        this.customerForm.reset();
        alert('Customer created successfully!');
      },
      error: (err) => {
        alert('Failed to create customer: ' + err.message);
        this.loading.set(false);
      }
    });
  }

  viewCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.loadTransactions(customer.id);
  }

  loadTransactions(customerId: string): void {
    this.customerService.getLoyaltyTransactions(customerId).subscribe({
      next: (transactions) => this.transactions.set(transactions),
      error: () => this.transactions.set([])
    });
  }

  addPoints(): void {
    const customer = this.selectedCustomer();
    if (!customer) return;

    const points = prompt('Enter points to add:');
    if (!points) return;

    const description = prompt('Description:') || 'Manual points addition';

    this.customerService.addLoyaltyPoints(customer.id, parseInt(points), description).subscribe({
      next: () => {
        this.loadCustomers();
        this.loadTransactions(customer.id);
        alert('Points added successfully!');
      },
      error: (err) => alert('Failed: ' + err.message)
    });
  }

  redeemPoints(): void {
    const customer = this.selectedCustomer();
    if (!customer) return;

    const points = prompt('Enter points to redeem:');
    if (!points) return;

    const description = prompt('Description:') || 'Points redemption';

    this.customerService.redeemLoyaltyPoints(customer.id, parseInt(points), description).subscribe({
      next: () => {
        this.loadCustomers();
        this.loadTransactions(customer.id);
        alert('Points redeemed successfully!');
      },
      error: (err) => alert('Failed: ' + err.message)
    });
  }

  deleteCustomer(customer: Customer): void {
    if (confirm(`Delete ${customer.name}?`)) {
      this.customerService.delete(customer.id).subscribe({
        next: () => {
          this.loadCustomers();
          if (this.selectedCustomer()?.id === customer.id) {
            this.selectedCustomer.set(null);
          }
        },
        error: (err) => alert('Failed: ' + err.message)
      });
    }
  }
}
