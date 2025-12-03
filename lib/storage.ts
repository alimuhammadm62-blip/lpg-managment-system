// lib/storage.ts - Local storage helper functions

export const storage = {
  get: <T>(key: string): T | null => {
    if (typeof window === 'undefined') return null;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return null;
    }
  },

export function safeGetArray<T>(key: string): T[] {
  const data = storage.get(key);

  // If not array → reset and return []
  if (!Array.isArray(data)) {
    storage.set(key, []);
    return [];
  }

  return data as T[];
}


  set: <T>(key: string, value: T): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  },

  remove: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error);
    }
  }
};

// Storage keys
export const STORAGE_KEYS = {
  PURCHASES: 'lpg_purchases',
  SALES: 'lpg_sales',
  CUSTOMERS: 'lpg_customers',
  CREDITS: 'lpg_credits',
  ACCOUNTS: 'lpg_accounts',
  TRANSACTIONS: 'lpg_transactions',
  CUSTOM_ITEMS: 'lpg_custom_items',
  ITEM_PRICES: 'item_prices',
};

// Initialize default accounts
export const initializeAccounts = () => {
  const accounts = storage.get(STORAGE_KEYS.ACCOUNTS);
  if (!accounts) {
    storage.set(STORAGE_KEYS.ACCOUNTS, [
      { id: '1', name: 'Shop', type: 'shop', balance: 0 },
      { id: '2', name: 'Bank', type: 'bank', balance: 0 },
      { id: '3', name: 'Home', type: 'home', balance: 0 },
      { id: '4', name: 'Equity', type: 'equity', balance: 0 }
    ]);
  }
};