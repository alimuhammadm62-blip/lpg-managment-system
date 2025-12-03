'use client';

import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, Wallet, History, User, X, Edit2, Trash2, Calendar, Save } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { CreditTransaction, Customer, Account, SaleItem, PurchaseItem } from '@/lib/types';
import { format, differenceInDays, startOfMonth, endOfMonth } from 'date-fns';

// Extend the type locally to support the new 'payment' type distinction
interface ExtendedCreditTransaction extends CreditTransaction {
  type?: 'credit' | 'payment'; 
}

export default function CreditPage() {
  const [credits, setCredits] = useState<ExtendedCreditTransaction[]>([]);
  const [filteredCredits, setFilteredCredits] = useState<ExtendedCreditTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'overdue'>('all');
  
  // Date Filter State
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  
  // Modals
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Selection & Form Data
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Customer Edit Data
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Transaction Edit Data (Inside History Modal)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editTransAmount, setEditTransAmount] = useState('');
  const [editTransDate, setEditTransDate] = useState('');

  useEffect(() => {
    loadCredits();
    loadCustomers();
  }, []);

  useEffect(() => {
    if (showDateFilter) {
      filterCreditsByDateRange();
    }
  }, [credits, dateRange, showDateFilter]);

  const filterCreditsByDateRange = () => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = credits.filter(credit => {
      const creditDate = new Date(credit.date);
      return creditDate >= start && creditDate <= end;
    });

    setFilteredCredits(filtered);
  };

  const loadCredits = () => {
    const data = storage.get<ExtendedCreditTransaction[]>(STORAGE_KEYS.CREDITS) || [];
    const normalizedData = data.map(c => ({
      ...c,
      type: c.type || 'credit' as const
    }));
    
    // Note: We removed the old 'overdue' status mutation loop here 
    // because we now calculate it dynamically based on last payment date.

    setCredits(normalizedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const loadCustomers = () => {
    const data = storage.get<Customer[]>(STORAGE_KEYS.CUSTOMERS) || [];
    setCustomers(data);
  };

  // --- Utility for Historical Balance Check ---
  const getBalanceBefore = (transactionId: string, customerId: string, allCredits: ExtendedCreditTransaction[]): number => {
    const customerCredits = allCredits
      .filter(c => c.customerId === customerId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    
    for (const record of customerCredits) {
        if (record.id === transactionId) {
            return Math.max(0, runningBalance); 
        }
        const isPayment = record.type === 'payment';
        const amount = record.amount;
        
        if (isPayment) {
            runningBalance -= amount;
        } else {
            runningBalance += amount;
        }
    }
    return 0; 
  };

  // --- Payment Logic ---
  const handleReceivePayment = () => {
    if (!selectedCustomer || !paymentAmount || !paymentDate) {
      alert('Please enter payment amount and date');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (amount > selectedCustomer.pendingAmount) {
      alert(`Payment amount cannot exceed pending balance of Rs ${selectedCustomer.pendingAmount.toLocaleString('en-PK')}`);
      return;
    }

    const paymentTransaction: ExtendedCreditTransaction = {
      id: `pay-${Date.now()}`,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      amount: amount,
      date: new Date(paymentDate),
      dueDate: new Date(paymentDate),
      status: 'paid', 
      saleId: '', 
      type: 'payment' 
    };

    const sales = (storage.get<SaleItem[]>(STORAGE_KEYS.SALES) || []) as (Omit<SaleItem, 'paymentStatus'> & { 
      amountRemaining?: number; 
      amountPaid?: number; 
      paymentStatus?: string; 
    })[];
    
    const unpaidSales = sales
      .filter(s => s.customerId === selectedCustomer.id && s.paymentStatus !== 'paid')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let remainingPaymentToDistribute = amount;

    for (const sale of unpaidSales) {
      if (remainingPaymentToDistribute <= 0) break;

      const currentRemaining = sale.amountRemaining !== undefined ? sale.amountRemaining : sale.totalAmount;
      const amountToCover = Math.min(currentRemaining, remainingPaymentToDistribute);

      sale.amountPaid = (sale.amountPaid || 0) + amountToCover;
      sale.amountRemaining = currentRemaining - amountToCover;
      
      if (sale.amountRemaining <= 0) {
        sale.amountRemaining = 0;
        sale.paymentStatus = 'paid';
      } else {
        sale.paymentStatus = 'partial';
      }

      remainingPaymentToDistribute -= amountToCover;
    }

    const accounts: Account[] = storage.get(STORAGE_KEYS.ACCOUNTS) || [];
    const shopAccount = accounts.find(a => a.type === 'shop');
    if (shopAccount) {
      shopAccount.balance += amount;
      storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
    }

    const newCredits = [...credits, paymentTransaction];
    storage.set(STORAGE_KEYS.CREDITS, newCredits);
    storage.set(STORAGE_KEYS.SALES, sales);
    setCredits(newCredits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    
    setShowPaymentModal(false);
    setPaymentAmount('');
    setSelectedCustomer(null);
  };

  // --- Transaction Management ---
  const handleDeleteTransaction = (transaction: ExtendedCreditTransaction) => {
    if (transaction.type === 'credit') {
      const balanceAfterDeletion = getBalanceBefore(transaction.id, transaction.customerId, credits) - transaction.amount;
      if (balanceAfterDeletion < 0) {
        alert(`Cannot delete this credit transaction. Deleting it would result in an overpayment. Please adjust or remove payments first.`);
        return;
      }
    }
    if (!confirm('Are you sure you want to delete this transaction? This will update Sales and Inventory.')) return;

    const sales = (storage.get<SaleItem[]>(STORAGE_KEYS.SALES) || []) as (Omit<SaleItem, 'paymentStatus'> & { 
      amountRemaining?: number; 
      amountPaid?: number; 
      paymentStatus?: string; 
    })[];
    const purchases = storage.get<PurchaseItem[]>(STORAGE_KEYS.PURCHASES) || [];

    if (transaction.type === 'payment') {
      let amountToRevert = transaction.amount;
      const customerSales = sales
        .filter(s => s.customerId === transaction.customerId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      for (const sale of customerSales) {
        if (amountToRevert <= 0) break;
        if ((sale.amountPaid || 0) > 0) {
          const revertableAmount = Math.min(sale.amountPaid || 0, amountToRevert);
          sale.amountPaid = (sale.amountPaid || 0) - revertableAmount;
          sale.amountRemaining = (sale.amountRemaining || 0) + revertableAmount;
          if (sale.amountRemaining > 0) {
            sale.paymentStatus = sale.amountRemaining === sale.totalAmount ? 'pending' : 'partial';
          }
          amountToRevert -= revertableAmount;
        }
      }
      
      const accounts: Account[] = storage.get(STORAGE_KEYS.ACCOUNTS) || [];
      const shopAccount = accounts.find(a => a.type === 'shop');
      if (shopAccount) {
        shopAccount.balance -= transaction.amount;
        storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
      }

    } else {
      if (transaction.saleId) {
        const saleToDelete = sales.find(s => s.id === transaction.saleId);
        if (saleToDelete) {
          if (saleToDelete.batchesUsed && saleToDelete.batchesUsed.length > 0) {
            for (const batch of saleToDelete.batchesUsed) {
              const purchase = purchases.find(p =>
                p.batchNumber === batch.batchId &&
                (saleToDelete.itemType === 'OTHER'
                  ? p.customItemName === saleToDelete.customItemName
                  : p.itemType === saleToDelete.itemType)
              );
              if (purchase) {
                purchase.remainingQuantity += batch.quantity;
              }
            }
          } else {
            const itemMatches = (p: PurchaseItem) => {
              if (saleToDelete.itemType === 'OTHER') {
                return p.itemType === 'OTHER' && p.customItemName === saleToDelete.customItemName;
              }
              return p.itemType === saleToDelete.itemType;
            };
            const sortedPurchases = purchases.filter(itemMatches).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            if (sortedPurchases.length > 0) {
              sortedPurchases[0].remainingQuantity += saleToDelete.quantity;
            }
          }
          const updatedSales = sales.filter(s => s.id !== transaction.saleId);
          storage.set(STORAGE_KEYS.SALES, updatedSales);
          storage.set(STORAGE_KEYS.PURCHASES, purchases); 
        }
      }
    }

    const updatedCredits = credits.filter(c => c.id !== transaction.id);
    storage.set(STORAGE_KEYS.CREDITS, updatedCredits);
    if (transaction.type === 'payment') storage.set(STORAGE_KEYS.SALES, sales);
    setCredits(updatedCredits);
  };

  const startEditingTransaction = (transaction: ExtendedCreditTransaction) => {
    setEditingTransactionId(transaction.id);
    setEditTransAmount(transaction.amount.toString());
    setEditTransDate(format(new Date(transaction.date), 'yyyy-MM-dd'));
  };

  const saveEditedTransaction = (originalTransaction: ExtendedCreditTransaction) => {
    const newAmount = parseFloat(editTransAmount);
    if (isNaN(newAmount) || newAmount <= 0) {
      alert('Invalid amount');
      return;
    }

    const updatedCredits = credits.map(c => {
      if (c.id === originalTransaction.id) {
        return {
          ...c,
          amount: newAmount,
          date: new Date(editTransDate)
        };
      }
      return c;
    });

    const sales = (storage.get<SaleItem[]>(STORAGE_KEYS.SALES) || []) as (Omit<SaleItem, 'paymentStatus'> & { 
      amountRemaining?: number; 
      amountPaid?: number; 
      paymentStatus?: string; 
    })[];
    
    if (originalTransaction.type === 'credit' && originalTransaction.saleId) {
      const sale = sales.find(s => s.id === originalTransaction.saleId);
      if (sale) {
        const amountPaid = sale.amountPaid || 0;
        
        if (newAmount < amountPaid) {
          alert(`The new credit amount (Rs ${newAmount.toLocaleString('en-PK')}) cannot be less than the amount already paid.`);
          setEditingTransactionId(null);
          return;
        }
        
        const currentCustomerCredits = credits.filter(c => c.customerId === originalTransaction.customerId);
        const totalDebt = currentCustomerCredits.filter(c => c.type === 'credit').reduce((sum, c) => sum + c.amount, 0);
        const totalPaid = currentCustomerCredits.filter(c => c.type === 'payment').reduce((sum, c) => sum + c.amount, 0);
        
        const debtDifference = newAmount - originalTransaction.amount;
        const newTotalDebt = totalDebt + debtDifference;
        
        if (newTotalDebt < totalPaid) {
          alert(`Cannot reduce credit. Total payments received would exceed total debt.`);
          setEditingTransactionId(null);
          return;
        }
        
        sale.totalAmount = newAmount;
        sale.date = new Date(editTransDate);
        sale.amountRemaining = newAmount - amountPaid;
        
        if (sale.amountRemaining <= 0) {
            sale.amountRemaining = 0;
            sale.paymentStatus = 'paid';
        } else if (amountPaid > 0) {
            sale.paymentStatus = 'partial';
        } else {
            sale.paymentStatus = 'pending';
        }
      }
    } else if (originalTransaction.type === 'payment') {
       const balanceBefore = getBalanceBefore(originalTransaction.id, originalTransaction.customerId, credits);
       if (newAmount > balanceBefore) {
            alert(`New payment amount cannot exceed the customer's outstanding debt.`);
            setEditingTransactionId(null);
            return;
       }

       const diff = newAmount - originalTransaction.amount;
       if (diff !== 0) {
           const accounts: Account[] = storage.get(STORAGE_KEYS.ACCOUNTS) || [];
           const shopAccount = accounts.find(a => a.type === 'shop');
           if (shopAccount) {
             shopAccount.balance += diff;
             storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
           }

           if (diff > 0) {
             const unpaidSales = sales
                .filter(s => s.customerId === originalTransaction.customerId && s.paymentStatus !== 'paid')
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

             let moneyDistributing = diff;
             for (const sale of unpaidSales) {
                if (moneyDistributing <= 0) break;
                const remaining = sale.amountRemaining !== undefined ? sale.amountRemaining : sale.totalAmount;
                const cover = Math.min(remaining, moneyDistributing);
                sale.amountPaid = (sale.amountPaid || 0) + cover;
                sale.amountRemaining = remaining - cover;
                moneyDistributing -= cover;
                if (sale.amountRemaining <= 0) sale.paymentStatus = 'paid';
                else sale.paymentStatus = 'partial';
             }
           } else {
             let moneyToTakeBack = Math.abs(diff);
             const paidSales = sales
                .filter(s => s.customerId === originalTransaction.customerId && (s.amountPaid || 0) > 0)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 

             for (const sale of paidSales) {
                if (moneyToTakeBack <= 0) break;
                const currentPaid = sale.amountPaid || 0;
                const revertAmount = Math.min(currentPaid, moneyToTakeBack);
                sale.amountPaid = currentPaid - revertAmount;
                sale.amountRemaining = (sale.amountRemaining || 0) + revertAmount;
                moneyToTakeBack -= revertAmount;
                if (sale.amountRemaining === sale.totalAmount) sale.paymentStatus = 'pending';
                else sale.paymentStatus = 'partial';
             }
           }
       }
    }

    storage.set(STORAGE_KEYS.SALES, sales);
    storage.set(STORAGE_KEYS.CREDITS, updatedCredits);
    setCredits(updatedCredits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setEditingTransactionId(null);
  };

  // --- Customer Management ---
  const handleEditCustomer = () => {
    if (!selectedCustomer || !editName.trim()) {
      alert('Please enter a customer name');
      return;
    }

    const updatedCustomers = customers.map(c => 
      c.id === selectedCustomer.id 
        ? { ...c, name: editName.trim(), phone: editPhone.trim() }
        : c
    );

    const updatedCredits = credits.map(c => 
      c.customerId === selectedCustomer.id 
        ? { ...c, customerName: editName.trim() }
        : c
    );

    const sales = storage.get<SaleItem[]>(STORAGE_KEYS.SALES) || [];
    const updatedSales = sales.map(s => 
      s.customerId === selectedCustomer.id
        ? { ...s, customerName: editName.trim() }
        : s
    );

    storage.set(STORAGE_KEYS.CUSTOMERS, updatedCustomers);
    storage.set(STORAGE_KEYS.CREDITS, updatedCredits);
    storage.set(STORAGE_KEYS.SALES, updatedSales);
    setCustomers(updatedCustomers);
    setCredits(updatedCredits);
    setShowEditModal(false);
    setSelectedCustomer({ ...selectedCustomer, name: editName.trim(), phone: editPhone.trim() });
  };

  const handleDeleteCustomer = () => {
    if (!selectedCustomer) return;
    if (selectedCustomer.pendingAmount > 0) {
      alert('Cannot delete customer with pending payments.');
      return;
    }
    if (confirm(`Delete ${selectedCustomer.name}? This removes all history.`)) {
      const updatedCustomers = customers.filter(c => c.id !== selectedCustomer.id);
      const updatedCredits = credits.filter(c => c.customerId !== selectedCustomer.id);
      storage.set(STORAGE_KEYS.CUSTOMERS, updatedCustomers);
      storage.set(STORAGE_KEYS.CREDITS, updatedCredits);
      setCustomers(updatedCustomers);
      setCredits(updatedCredits);
      setShowEditModal(false);
      setSelectedCustomer(null);
    }
  };

  // --- Derived State & Calculations ---
  
  // Define sourceCredits based on filter activation - used for TOP SUMMARY
  const sourceCredits = showDateFilter ? filteredCredits : credits;

  const customerSummary = customers.map(customer => {
    // 1. Transactions for the list (respects date filter for transaction counting)
    const customerListCredits = sourceCredits.filter(c => c.customerId === customer.id);
    
    // 2. All Time calculations (for Balance and Overdue checks)
    const allTimeCredits = credits.filter(c => c.customerId === customer.id);
    const totalDebt = allTimeCredits.filter(c => c.type === 'credit').reduce((sum, c) => sum + c.amount, 0);
    const totalPaid = allTimeCredits.filter(c => c.type === 'payment').reduce((sum, c) => sum + c.amount, 0);
    const pendingAmount = Math.max(0, totalDebt - totalPaid);

    // 3. New Overdue Logic
    // Logic: If they owe money AND haven't paid in 45 days.
    // If they paid recently, they are NOT overdue, even if they owe money.
    let isOverdue = false;
    
    if (pendingAmount > 0) {
      const today = new Date();
      // Find the most recent payment
      const lastPayment = allTimeCredits
        .filter(c => c.type === 'payment')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
      if (lastPayment) {
        // If they have made a payment, check if it was recent
        const daysSincePayment = differenceInDays(today, new Date(lastPayment.date));
        if (daysSincePayment > 45) {
          isOverdue = true;
        }
      } else {
        // If NO payment ever made, check the oldest credit (or just treat as overdue if debt is old)
        const firstCredit = allTimeCredits
           .filter(c => c.type === 'credit')
           .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
           
        if (firstCredit) {
           const daysSinceFirstCredit = differenceInDays(today, new Date(firstCredit.date));
           if (daysSinceFirstCredit > 45) {
             isOverdue = true;
           }
        }
      }
    }

    // Set overdueAmount to pendingAmount if flagged, otherwise 0 (for UI compatibility)
    const overdueAmount = isOverdue ? pendingAmount : 0;

    return {
      ...customer,
      pendingAmount, 
      overdueAmount,
      transactionCount: customerListCredits.length
    };
  }).filter(c => 
    // Show if they have transactions in the selected period (or if filter is off)
    showDateFilter ? c.transactionCount > 0 : c.transactionCount > 0
  );

  const getCustomerHistory = (customerId: string) => {
    const customerCredits = credits
      .filter(c => c.customerId === customerId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    
    return customerCredits.map(record => {
      const isPayment = record.type === 'payment';
      const amount = record.amount;
      if (isPayment) runningBalance -= amount;
      else runningBalance += amount;

      return {
        ...record,
        displayType: isPayment ? 'Payment' : 'Credit',
        credit: isPayment ? 0 : amount,
        received: isPayment ? amount : 0,
        runningBalance: runningBalance
      };
    });
  };

  const overdueCount = customerSummary.filter(c => c.overdueAmount > 0).length;

  // FIXED: Calculations now use 'sourceCredits' to respect the date filter
  const totalCreditOut = sourceCredits.filter(c => c.type === 'credit').reduce((sum, c) => sum + c.amount, 0);
  const totalCreditIn = sourceCredits.filter(c => c.type === 'payment').reduce((sum, c) => sum + c.amount, 0);
  const totalCredit = Math.max(0, totalCreditOut - totalCreditIn);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">Credit Management</h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4">
            <div className="flex flex-col items-center w-full sm:min-w-[200px] sm:w-auto">
              <p className="text-sm sm:text-base text-gray-900 font-semibold mb-1">Total Credit</p>
              <div className="bg-white shadow-lg rounded-xl px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 h-[60px] flex items-center justify-center w-full">
                <p className="text-xl sm:text-2xl font-bold text-blue-600">Rs {totalCredit.toLocaleString('en-PK')}</p>
              </div>
            </div>
            <div className="flex flex-col items-center w-full sm:min-w-[200px] sm:w-auto">
              <p className="text-sm sm:text-base text-gray-900 font-semibold mb-1">Credit Out</p>
              <div className="bg-white shadow-lg rounded-xl px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 h-[60px] flex items-center justify-center w-full">
                <p className="text-xl sm:text-2xl font-bold text-red-600">Rs {totalCreditOut.toLocaleString('en-PK')}</p>
              </div>
            </div>
            <div className="flex flex-col items-center w-full sm:min-w-[200px] sm:w-auto">
              <p className="text-sm sm:text-base text-gray-900 font-semibold mb-1">Credit In</p>
              <div className="bg-white shadow-lg rounded-xl px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 h-[60px] flex items-center justify-center w-full">
                <p className="text-xl sm:text-2xl font-bold text-green-600">Rs {totalCreditIn.toLocaleString('en-PK')}</p>
              </div>
            </div>
          </div>

          {overdueCount > 0 && (
            <div className="bg-red-50 text-red-700 px-4 py-2.5 rounded-lg flex items-center gap-2 border border-red-200 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold text-sm">Action Needed: {overdueCount} Overdue Customer{overdueCount > 1 ? 's' : ''} (No payment in 45 days)</span>
            </div>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search customer by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 text-slate-900 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all h-full"
              />
            </div>
            
            <button
              onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
              className={`flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all shadow-sm whitespace-nowrap h-[50px] ${
                filter === 'overdue'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {filter === 'overdue' ? 'Show All' : 'Filter Overdue'}
            </button>
            <button
              onClick={() => setShowDateFilter(!showDateFilter)}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all shadow-sm whitespace-nowrap h-[50px] ${
                showDateFilter 
                  ? 'bg-blue-700 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span className="hidden sm:inline">{showDateFilter ? 'Hide Date' : 'Filter by Date'}</span>
              <span className="sm:hidden">Date</span>
            </button>
          </div>

          {/* Date Filter Panel */}
          {showDateFilter && (
            <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">End Date</label>
                  <input 
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <select
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'year') {
                      setDateRange({
                        startDate: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
                        endDate: format(new Date(), 'yyyy-MM-dd')
                      });
                    } else if (value !== "") {
                      const monthIndex = parseInt(value);
                      const currentMonth = new Date().getMonth();
                      const currentYear = new Date().getFullYear();
                      // Logic: If selected month is future (e.g. Dec while in Jan), assume previous year
                      const targetYear = monthIndex > currentMonth ? currentYear - 1 : currentYear;
                      setDateRange({
                        startDate: format(new Date(targetYear, monthIndex, 1), 'yyyy-MM-dd'),
                        endDate: format(endOfMonth(new Date(targetYear, monthIndex, 1)), 'yyyy-MM-dd')
                      });
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <option value="">Select Period</option>
                  <option value="0">January</option>
                  <option value="1">February</option>
                  <option value="2">March</option>
                  <option value="3">April</option>
                  <option value="4">May</option>
                  <option value="5">June</option>
                  <option value="6">July</option>
                  <option value="7">August</option>
                  <option value="8">September</option>
                  <option value="9">October</option>
                  <option value="10">November</option>
                  <option value="11">December</option>
                  <option value="year">Current Year</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Customer Cards */}
        <div className="grid grid-cols-1 gap-4">
          {customerSummary
            .filter(customer => {
              const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesFilter = filter === 'all' || 
                                  (filter === 'overdue' && customer.overdueAmount > 0);
              return matchesSearch && matchesFilter;
            })
            .map(customer => {
              const isOverdue = customer.overdueAmount > 0;
              
              const lastPayment = credits
                .filter(c => c.customerId === customer.id && c.type === 'payment')
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              
              return (
                <div
                  key={customer.id}
                  className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-5 border-l-4 ${
                    isOverdue ? 'border-l-red-500 bg-red-50/10' : 'border-l-blue-500'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Left Side: Name, Edit Icon, Last Payment */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                         <button
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setEditName(customer.name);
                              setEditPhone(customer.phone);
                              setShowEditModal(true);
                            }}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        <h3 className="text-xl font-bold text-slate-800">{customer.name}</h3>
                        
                        {/* Last Payment in front of name */}
                        <div className="flex items-center gap-1.5 text-sm text-slate-500 bg-slate-50 px-2 py-1 rounded">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {lastPayment 
                              ? `Last Payment: ${format(new Date(lastPayment.date), 'dd/MM/yyyy')}`
                              : 'No payments'}
                          </span>
                        </div>
                        
                        {isOverdue && (
                          <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Side: Pending Balance -> Buttons */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Balance moved to the right, before buttons */}
                      <div className="flex items-center gap-2">
                         <span className="text-xs text-slate-500 uppercase font-bold sm:hidden">Balance:</span>
                         <p className={`text-2xl font-bold ${
                            customer.pendingAmount > 0 ? 'text-slate-800' : 'text-green-600'
                          }`}>
                            Rs {customer.pendingAmount.toLocaleString('en-PK')}
                          </p>
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setShowHistoryModal(true);
                          }}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          title="View History"
                        >
                          <History className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
                            setShowPaymentModal(true);
                          }}
                          disabled={customer.pendingAmount <= 0}
                          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                            customer.pendingAmount <= 0
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : isOverdue 
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          <Wallet className="w-4 h-4" />
                          <span>Receive</span>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          
          {customerSummary.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-800 mb-2">No customers found</h3>
              <p className="text-slate-500">
                {showDateFilter ? "No transactions found in this date range." : "Try adjusting your search or filters."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl font-bold">{selectedCustomer.name}</h2>
                <p className="text-blue-100 text-sm mt-1">Transaction History</p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setEditingTransactionId(null);
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="bg-blue-50 rounded-xl p-5 mb-6 border border-blue-100 flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Current Pending Balance</p>
                  <p className="text-3xl font-bold text-blue-600">Rs {selectedCustomer.pendingAmount.toLocaleString('en-PK')}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Date</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Debt (Credit)</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Payment (Received)</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Balance</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getCustomerHistory(selectedCustomer.id).map((record, index) => (
                      <tr key={record.id || index} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-4 px-4 text-sm text-slate-800 font-medium">
                          {editingTransactionId === record.id ? (
                            <input 
                              type="date" 
                              value={editTransDate}
                              onChange={(e) => setEditTransDate(e.target.value)}
                              className="border rounded p-1 text-sm w-32"
                            />
                          ) : (
                            format(new Date(record.date), 'dd MMM yyyy')
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm text-right">
                          {record.credit > 0 ? (
                            editingTransactionId === record.id ? (
                              <input 
                                type="number" 
                                value={editTransAmount}
                                onChange={(e) => setEditTransAmount(e.target.value)}
                                className="border rounded p-1 text-sm w-24 text-right"
                              />
                            ) : (
                              <span className="text-red-600 font-semibold">Rs {record.credit.toLocaleString('en-PK')}</span>
                            )
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm text-right">
                          {record.received > 0 ? (
                             editingTransactionId === record.id ? (
                              <input 
                                type="number" 
                                value={editTransAmount}
                                onChange={(e) => setEditTransAmount(e.target.value)}
                                className="border rounded p-1 text-sm w-24 text-right"
                              />
                            ) : (
                              <span className="text-green-600 font-semibold">Rs {record.received.toLocaleString('en-PK')}</span>
                            )
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm text-right font-bold text-slate-800">
                          Rs {record.runningBalance.toLocaleString('en-PK')}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2"> 
                            {editingTransactionId === record.id ? (
                              <button 
                                onClick={() => saveEditedTransaction(record)}
                                className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => startEditingTransaction(record)}
                                className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-blue-100 hover:text-blue-600"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            
                            <button 
                              onClick={() => handleDeleteTransaction(record)}
                              className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-red-100 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Receive Payment</h2>
              <p className="text-blue-100 text-sm mt-1">Enter payment details below</p>
            </div>
            
            <div className="p-6">
              <div className="mb-5">
                <p className="text-sm text-slate-500 mb-1">Customer</p>
                <p className="text-lg font-semibold text-slate-800">{selectedCustomer.name}</p>
              </div>

              <div className="mb-5 bg-red-50 rounded-lg p-4 border border-red-100">
                <p className="text-sm text-slate-600 mb-1">Pending Balance</p>
                <p className="text-2xl font-bold text-red-600">Rs {selectedCustomer.pendingAmount.toLocaleString('en-PK')}</p>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Payment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-600 font-medium">Rs</span>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentAmount('');
                    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
                  }}
                  className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReceivePayment}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-lg shadow-blue-500/30"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Edit Customer</h2>
            </div>
            
            <div className="p-6">
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone Number <span className="text-slate-400 text-xs font-normal">(Optional)</span>
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteCustomer}
                  className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                  }}
                  className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditCustomer}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-lg shadow-blue-500/30"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}