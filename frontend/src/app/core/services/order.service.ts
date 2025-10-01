import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, CreateOrderDto } from '../models/order.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly API_URL = `${environment.apiUrl}/api/orders`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Order[]> {
    return this.http.get<Order[]>(this.API_URL);
  }

  getById(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.API_URL}/${id}`);
  }

  create(dto: CreateOrderDto): Observable<Order> {
    return this.http.post<Order>(this.API_URL, dto);
  }

  cancel(id: string): Observable<Order> {
    return this.http.post<Order>(`${this.API_URL}/${id}/cancel`, {});
  }

  printReceipt(id: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/${id}/receipt`, { responseType: 'blob' });
  }
}
