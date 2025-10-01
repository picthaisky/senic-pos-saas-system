import { Injectable } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface PosDB extends DBSchema {
  orders: {
    key: string;
    value: any;
    indexes: { 'by-date': Date };
  };
  inventory: {
    key: string;
    value: any;
  };
  customers: {
    key: string;
    value: any;
  };
}

@Injectable({
  providedIn: 'root'
})
export class OfflineStorageService {
  private db: IDBPDatabase<PosDB> | null = null;
  private readonly DB_NAME = 'pos-saas-db';
  private readonly DB_VERSION = 1;

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<void> {
    this.db = await openDB<PosDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Orders store
        if (!db.objectStoreNames.contains('orders')) {
          const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
          orderStore.createIndex('by-date', 'createdAt');
        }

        // Inventory store
        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'id' });
        }

        // Customers store
        if (!db.objectStoreNames.contains('customers')) {
          db.createObjectStore('customers', { keyPath: 'id' });
        }
      },
    });
  }

  // Orders
  async saveOrder(order: any): Promise<void> {
    if (!this.db) await this.initDB();
    await this.db!.put('orders', order);
  }

  async getOrders(): Promise<any[]> {
    if (!this.db) await this.initDB();
    return this.db!.getAll('orders');
  }

  async getOrder(id: string): Promise<any | undefined> {
    if (!this.db) await this.initDB();
    return this.db!.get('orders', id);
  }

  // Inventory
  async saveInventoryItems(items: any[]): Promise<void> {
    if (!this.db) await this.initDB();
    const tx = this.db!.transaction('inventory', 'readwrite');
    await Promise.all(items.map(item => tx.store.put(item)));
    await tx.done;
  }

  async getInventoryItems(): Promise<any[]> {
    if (!this.db) await this.initDB();
    return this.db!.getAll('inventory');
  }

  async getInventoryItem(id: string): Promise<any | undefined> {
    if (!this.db) await this.initDB();
    return this.db!.get('inventory', id);
  }

  // Customers
  async saveCustomers(customers: any[]): Promise<void> {
    if (!this.db) await this.initDB();
    const tx = this.db!.transaction('customers', 'readwrite');
    await Promise.all(customers.map(customer => tx.store.put(customer)));
    await tx.done;
  }

  async getCustomers(): Promise<any[]> {
    if (!this.db) await this.initDB();
    return this.db!.getAll('customers');
  }

  async getCustomer(id: string): Promise<any | undefined> {
    if (!this.db) await this.initDB();
    return this.db!.get('customers', id);
  }

  // Clear all data
  async clearAll(): Promise<void> {
    if (!this.db) await this.initDB();
    await this.db!.clear('orders');
    await this.db!.clear('inventory');
    await this.db!.clear('customers');
  }
}
