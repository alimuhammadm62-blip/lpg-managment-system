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
  CUSTOM_ITEMS: 'lpg_custom_items'
};

// Initialize default accounts
export const initializeAccounts = () => {
  const accounts = storage.get(STORAGE_KEYS.ACCOUNTS);
  if (!accounts) {
    storage.set(STORAGE_KEYS.ACCOUNTS, [
      { id: '1', name: 'Shop', type: 'shop', balance: 0 },
      { id: '2', name: 'Bank', type: 'bank', balance: 0 },
      { id: '3', name: 'Home', type: 'home', balance: 0 }
    ]);
  }
};