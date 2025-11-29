// lib/types.ts - All TypeScript type definitions

export type ItemType = 'BN' | 'SN' | 'C' | 'BNS' | 'SNS' | 'CS' | 'ABN' | 'ASN' | 'OTHER';

export interface PurchaseItem {
  id: string;
  date: Date;
  itemType: ItemType;
  customItemName?: string;
  quantity: number;
  pricePerUnit: number;
  totalCost: number;
  supplier: string;
  batchNumber: string;
  remainingQuantity: number;
}

export interface SaleItem {
  id: string;
  date: Date;
  itemType: ItemType;
  customItemName?: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  customerId?: string;
  customerName?: string;
  isCredit: boolean;
  paymentStatus: 'paid' | 'pending';
    batchesUsed?: Array<{
    batchId: string;
    quantity: number;
  }>;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalCredit: number;
  lastPurchaseDate: Date;
}

export interface CreditTransaction {
  id: string;
  customerId: string;
  customerName: string;
  saleId: string;
  amount: number;
  date: Date;
  dueDate: Date;
  paymentDate?: Date;
  status: 'pending' | 'paid' | 'overdue';
}

export type AccountType = 'shop' | 'bank' | 'home';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
}

export interface Transaction {
  id: string;
  date: Date;
  type: 'expense' | 'transfer' | 'deposit' | 'sale';
  amount: number;
  fromAccount?: string;
  toAccount?: string;
  category: string;
  description: string;
}

export interface InventoryItem {
  itemType: ItemType;
  customItemName?: string;
  totalQuantity: number;
  averageCost: number;
  batches: PurchaseItem[];
}

export interface DashboardStats {
  grossProfit: number;
  netSales: number;
  totalExpense: number;
  netProfit: number;
  averageDailySales: number;
  totalInventoryValue: number;
  pendingCredits: number;
  overdueCredits: number;
}