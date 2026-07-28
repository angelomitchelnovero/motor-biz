// Type definitions for the contextBridge API exposed by preload.ts
// Mirrors the IPC handlers registered in electron/main.ts

export type Role = 'owner' | 'manager' | 'cashier' | 'mechanic' | 'inv_clerk' | 'accountant' | 'auditor';

export interface SessionUser {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  must_change_password: boolean;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  contact: string;
  address: string;
  tin: string;
  type: 'retail' | 'fleet';
  credit_limit: number;
  active: boolean;
}

export interface Vehicle {
  id: number;
  customer_id: number;
  plate_number: string;
  make: string;
  model: string;
  year: number | null;
  color: string;
  engine_no: string;
  chassis_no: string;
  current_odometer: number;
  customer_name?: string;
  last_service?: string;
}

export interface Supplier {
  id: number;
  name: string;
  tin: string;
  contact: string;
  address: string;
  terms: 'cash' | 'net30' | 'net60';
  active: boolean;
}

export interface Item {
  id: number;
  sku: string;
  barcode: string | null;
  part_number: string;
  oem_ref: string;
  name: string;
  category: string;
  brand: string;
  unit: 'pc' | 'set' | 'L' | 'ml' | 'g';
  cost: number;
  price: number;
  markup_pct: number;
  reorder_point: number;
  reorder_qty: number;
  preferred_supplier_id: number | null;
  location: string;
  active: boolean;
  stock_on_hand?: number;
  stock_value?: number;
}

export interface StockMovement {
  id: number;
  item_id: number;
  item_name?: string;
  type: 'receive' | 'adjust' | 'transfer_out' | 'transfer_in' | 'return_supplier' | 'damaged' | 'used_in_jo' | 'sold' | 'refund_in';
  qty: number;
  unit_cost: number;
  reference_type: string;
  reference_id: number | null;
  reason: string;
  user_name?: string;
  created_at: string;
}

export type JoStatus = 'queued' | 'in_progress' | 'awaiting_parts' | 'ready' | 'released' | 'cancelled';

export interface JobOrder {
  id: number;
  jo_number: string;
  vehicle_id: number;
  customer_id: number;
  plate_number?: string;
  customer_name?: string;
  vehicle_label?: string;
  complaint: string;
  status: JoStatus;
  current_odometer: number;
  primary_mechanic_id: number | null;
  primary_mechanic_name?: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  completed_at: string | null;
  released_at: string | null;
  lines?: JoLine[];
}

export interface JoLine {
  id: number;
  jo_id: number;
  kind: 'part' | 'service';
  item_id: number | null;
  description: string;
  qty: number;
  unit_price: number;
  line_discount: number;
  mechanic_id: number | null;
  mechanic_name?: string;
  line_total: number;
}

export interface CartLine {
  kind: 'part' | 'service';
  item_id?: number;
  description: string;
  qty: number;
  unit_price: number;
  line_discount: number;
  vat_type: 'vatable' | 'exempt' | 'zero';
  mechanic_id?: number | null;
}

export interface PaymentLine {
  method: 'cash' | 'gcash' | 'maya' | 'card' | 'bank' | 'charge';
  amount: number;
  reference_no?: string;
}

export interface SaleResult {
  id: number;
  sale_number: string;
  document_type: 'SI' | 'OR';
  total: number;
  vat_amount: number;
  vatable_sale: number;
  vat_exempt: number;
  zero_rated: number;
  change_due: number;
  receipt_pdf_path: string;
}

export interface Settings {
  business_name: string;
  address1: string;
  address2: string;
  tin: string;
  vat_reg_tin: string;
  bir_atp_sn: string;
  bir_atp_min: string;
  bir_atp_date: string;
  vat_mode: 'inclusive' | 'exclusive';
  sc_discount_pct: number;
  pwd_discount_pct: number;
  default_branch: string;
  default_terminal: string;
}

export interface ReceiptSeries {
  id: number;
  document_type: 'SI' | 'OR';
  branch: string;
  terminal: string;
  prefix: string;
  start_no: number;
  end_no: number;
  current_no: number;
  active: boolean;
}

export interface DailySalesRow {
  date: string;
  sales_count: number;
  gross: number;
  vatable: number;
  vat_exempt: number;
  zero_rated: number;
  vat_amount: number;
  discount_total: number;
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
  value: number;
  reorder_point: number;
  below_reorder: boolean;
}

export interface MechanicCommissionRow {
  mechanic_id: number;
  mechanic_name: string;
  labor_amount: number;
  jo_count: number;
  commission_amount: number;
}

export interface BirExportRow {
  date: string;
  sale_number: string;
  document_type: string;
  tin: string;
  customer_name: string;
  vatable_sale: number;
  vat_exempt: number;
  zero_rated: number;
  vat_amount: number;
  total: number;
}

export interface ReportFilters {
  from?: string;
  to?: string;
  mechanic_id?: number;
  document_type?: 'SI' | 'OR' | 'all';
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
        receive: (input: { item_id: number; qty: number; unit_cost: number; supplier_id?: number | null; reason?: string }) => Promise<StockMovement>;
        adjust: (input: { item_id: number; qty_delta: number; reason: string }) => Promise<StockMovement>;
        listMovements: (item_id: number, limit?: number) => Promise<StockMovement[]>;
        stockOnHand: () => Promise<StockOnHandRow[]>;
      };
      customers: {
        list: (q?: string) => Promise<Customer[]>;
        get: (id: number) => Promise<Customer>;
        create: (input: Omit<Customer, 'id'>) => Promise<Customer>;
        update: (id: number, input: Partial<Customer>) => Promise<Customer>;
      };
      vehicles: {
        list: (q?: string) => Promise<Vehicle[]>;
        get: (id: number) => Promise<Vehicle>;
        create: (input: Omit<Vehicle, 'id' | 'customer_name' | 'last_service'>) => Promise<Vehicle>;
        update: (id: number, input: Partial<Vehicle>) => Promise<Vehicle>;
        lookupByPlate: (plate: string) => Promise<Vehicle | null>;
        serviceHistory: (vehicle_id: number) => Promise<JobOrder[]>;
      };
      suppliers: {
        list: () => Promise<Supplier[]>;
        get: (id: number) => Promise<Supplier>;
        create: (input: Omit<Supplier, 'id'>) => Promise<Supplier>;
        update: (id: number, input: Partial<Supplier>) => Promise<Supplier>;
      };
      jobOrders: {
        list: (status?: string) => Promise<JobOrder[]>;
        get: (id: number) => Promise<JobOrder>;
        create: (input: { vehicle_id: number; customer_id: number; complaint: string; current_odometer: number; primary_mechanic_id: number | null; lines: Omit<JoLine, 'id' | 'jo_id' | 'line_total'>[] }) => Promise<JobOrder>;
        updateStatus: (id: number, status: string, note?: string) => Promise<JobOrder>;
        assignMechanic: (id: number, mechanic_id: number | null) => Promise<JobOrder>;
        addLine: (jo_id: number, line: Omit<JoLine, 'id' | 'jo_id' | 'line_total'>) => Promise<JoLine>;
        removeLine: (jo_id: number, line_id: number) => Promise<void>;
      };
      sales: {
        checkout: (input: {
          jo_id?: number | null;
          customer_id?: number | null;
          vehicle_id?: number | null;
          document_type: 'SI' | 'OR';
          series_id: number;
          lines: CartLine[];
          payments: PaymentLine[];
          sc_pwd?: { kind: 'SC' | 'PWD'; id_no: string; name: string } | null;
          odometer?: number | null;
        }) => Promise<SaleResult>;
        void: (sale_id: number, reason: string) => Promise<void>;
        refund: (sale_id: number, reason: string) => Promise<void>;
        get: (id: number) => Promise<{ sale: any; lines: any[]; payments: any[] }>;
        previewReceipt: (sale_id: number) => Promise<string>;
      };
      reports: {
        dailySales: (filters: ReportFilters) => Promise<DailySalesRow[]>;
        stockOnHand: () => Promise<StockOnHandRow[]>;
        mechanicCommission: (filters: ReportFilters) => Promise<MechanicCommissionRow[]>;
        birExport: (filters: ReportFilters) => Promise<BirExportRow[]>;
      };
      settings: {
        get: () => Promise<Settings>;
        update: (input: Partial<Settings>) => Promise<Settings>;
        listSeries: () => Promise<ReceiptSeries[]>;
        createSeries: (input: Omit<ReceiptSeries, 'id' | 'current_no'>) => Promise<ReceiptSeries>;
        setSeriesActive: (id: number, active: boolean) => Promise<void>;
      };
      shell: {
        openPath: (p: string) => Promise<void>;
      };
    };
  }
}

export {};
