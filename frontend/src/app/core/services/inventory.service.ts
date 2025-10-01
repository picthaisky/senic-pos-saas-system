import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { InventoryItem, CreateInventoryItemDto, UpdateInventoryItemDto, InventoryFilter } from '../models/inventory.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private readonly API_URL = `${environment.apiUrl}/api/inventory`;

  constructor(private http: HttpClient) {}

  getAll(filter?: InventoryFilter): Observable<InventoryItem[]> {
    let params = new HttpParams();
    if (filter?.search) params = params.set('search', filter.search);
    if (filter?.category) params = params.set('category', filter.category);
    if (filter?.isActive !== undefined) params = params.set('isActive', filter.isActive.toString());
    if (filter?.lowStock !== undefined) params = params.set('lowStock', filter.lowStock.toString());

    return this.http.get<InventoryItem[]>(this.API_URL, { params });
  }

  getById(id: string): Observable<InventoryItem> {
    return this.http.get<InventoryItem>(`${this.API_URL}/${id}`);
  }

  create(dto: CreateInventoryItemDto): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(this.API_URL, dto);
  }

  update(dto: UpdateInventoryItemDto): Observable<InventoryItem> {
    return this.http.put<InventoryItem>(`${this.API_URL}/${dto.id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  searchByBarcode(barcode: string): Observable<InventoryItem | null> {
    return this.http.get<InventoryItem | null>(`${this.API_URL}/barcode/${barcode}`);
  }

  getLowStock(): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>(`${this.API_URL}/low-stock`);
  }
}
