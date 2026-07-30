// Type definitions for the contextBridge API exposed by preload.ts
// Mirrors the IPC handlers registered in electron/main.ts

export type Role = 'owner' | 'manager' | 'cashier' | 'stock_clerk';

export interface SessionUser {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  must_change_password: boolean;
}

export interface Item {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  brand: string;
  unit: 'pc' | 'set' | 'L' | 'ml' | 'g';
  cost: number;
  price: number;
  reorder_point: number;
  location: string;
  active: boolean;
  stock_on_hand?: number;
  stock_value?: number;
}

export interface StockMovement {
  id: number;
  item_id: number;
  item_name?: string;
  type: 'receive' | 'adjust' | 'sold' | 'refund_in';
  qty: number;
  unit_cost: number;
  reference_type: string;
  reference_id: number | null;
  reason: string;
  user_name?: string;
  created_at: string;
}

export interface CartLine {
  item_id?: number | null;
  description: string;
  qty: number;
  unit_price: number;
  line_discount: number;
}

export interface SaleResult {
  id: number;
  sale_number: string;
  total: number;
  change_due: number;
  receipt_pdf_path: string;
}

export interface Settings {
  business_name: string;
  address1: string;
  address2: string;
}

export interface PaymentBreakdown {
  cash: number;
  gcash: number;
  card: number;
  other: number;
}

export interface DailySalesRow {
  date: string;
  sales_count: number;
  gross: number;
  payment_breakdown: PaymentBreakdown;
  void_count: number;
  void_amount: number;
}

export interface StockOnHandRow {
  item_id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  cost: number;
  reorder_point: number;
  below_reorder: boolean;
  value: number;
}

export interface ReportFilters {
  from?: string;
  to?: string;
}

declare global {
  interface Window {
    api: {
      auth: {
        login: (username: string, password: string) => Promise<SessionUser>;
        logout: () => Promise<void>;
        currentUser: () => Promise<SessionUser | null>;
        changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
        listUsers: () => Promise<SessionUser[]>;
        createUser: (input: { username: string; password: string; full_name: string; role: Role }) => Promise<SessionUser>;
        setUserActive: (id: number, active: boolean) => Promise<void>;
      };
      items: {
        list: (q?: string) => Promise<Item[]>;
        get: (id: number) => Promise<Item>;
        create: (input: Omit<Item, 'id' | 'stock_on_hand' | 'stock_value'>) => Promise<Item>;
        update: (id: number, input: Partial<Item>) => Promise<Item>;
        lookupByBarcode: (barcode: string) => Promise<Item | null>;
      };
      stock: {
        receive: (input: { item_id: number; qty: number; unit_cost: number; reason?: string }) => Promise<StockMovement>;
        adjust: (input: { item_id: number; qty_delta: number; reason: string }) => Promise<StockMovement>;
        listMovements: (item_id: number, limit?: number) => Promise<StockMovement[]>;
        stockOnHand: () => Promise<StockOnHandRow[]>;
      };
      sales: {
        checkout: (input: {
          lines: CartLine[];
          payment_method: 'cash' | 'gcash' | 'card' | 'other';
          tendered: number;
          customer_name?: string | null;
        }) => Promise<SaleResult>;
        void: (sale_id: number, reason: string) => Promise<void>;
        get: (id: number) => Promise<{ sale: any; lines: any[] }>;
        previewReceipt: (id: number) => Promise<string>;
      };
      reports: {
        dailySales: (filters: ReportFilters) => Promise<DailySalesRow[]>;
        stockOnHand: () => Promise<StockOnHandRow[]>;
      };
      settings: {
        get: () => Promise<Settings>;
        update: (input: Partial<Settings>) => Promise<Settings>;
      };
      shell: {
        openPath: (p: string) => Promise<void>;
      };
    };
  }
}

export {};