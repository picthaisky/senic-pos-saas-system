import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Customer, CreateCustomerDto, UpdateCustomerDto, LoyaltyTransaction } from '../models/customer.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private readonly API_URL = `${environment.apiUrl}/api/customers`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.API_URL);
  }

  getById(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${this.API_URL}/${id}`);
  }

  create(dto: CreateCustomerDto): Observable<Customer> {
    return this.http.post<Customer>(this.API_URL, dto);
  }

  update(dto: UpdateCustomerDto): Observable<Customer> {
    return this.http.put<Customer>(`${this.API_URL}/${dto.id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  getLoyaltyTransactions(customerId: string): Observable<LoyaltyTransaction[]> {
    return this.http.get<LoyaltyTransaction[]>(`${this.API_URL}/${customerId}/loyalty`);
  }

  addLoyaltyPoints(customerId: string, points: number, description: string): Observable<Customer> {
    return this.http.post<Customer>(`${this.API_URL}/${customerId}/loyalty`, { points, description });
  }

  redeemLoyaltyPoints(customerId: string, points: number, description: string): Observable<Customer> {
    return this.http.post<Customer>(`${this.API_URL}/${customerId}/loyalty/redeem`, { points, description });
  }
}
