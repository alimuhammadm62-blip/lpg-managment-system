'use client';

import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, Wallet, History, User, X, Edit2, Trash2, Phone, Calendar, Save } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { CreditTransaction, Customer, Account, SaleItem, PurchaseItem } from '@/lib/types';
import { format, differenceInDays } from 'date-fns';

// Extend the type locally to support the new 'payment' type distinction
interface ExtendedCreditTransaction extends CreditTransaction {
  type?: 'credit' | 'payment'; 
}

export default function CreditPage() {
  const [credits, setCredits] = useState<ExtendedCreditTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'overdue'>('all');
  
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

  const loadCredits = () => {
    const data = storage.get<ExtendedCreditTransaction[]>(STORAGE_KEYS.CREDITS) || [];
    // Ensure all legacy data defaults to 'credit' type if missing
    const normalizedData = data.map(c => ({
      ...c,
      type: c.type || 'credit' as const
    }));
    
    // Check for overdue status on credits
    const today = new Date();
    normalizedData.forEach(credit => {
      if (credit.type === 'credit' && credit.status === 'pending') {
        const daysPending = differenceInDays(today, new Date(credit.date));
        if (daysPending > 45) {
          credit.status = 'overdue';
        }
      }
    });

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
      // Sort oldest first to correctly calculate running balance
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    
    for (const record of customerCredits) {
        if (record.id === transactionId) {
            return Math.max(0, runningBalance); // Return balance *before* this record
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

    // Update Sales Data
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

    // Update Shop Account
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

  // --- Transaction Management (Edit/Delete in History) ---

  const handleDeleteTransaction = (transaction: ExtendedCreditTransaction) => {
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
      // Deleting a CREDIT
      if (transaction.saleId) {
        const saleToDelete = sales.find(s => s.id === transaction.saleId);
        
        if (saleToDelete) {
          // Restore Inventory
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
    if (transaction.type === 'payment') {
        storage.set(STORAGE_KEYS.SALES, sales);
    }
    
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

    // 1. Update the Local Credit Record
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

    // 2. Sync with Sales Page
    const sales = (storage.get<SaleItem[]>(STORAGE_KEYS.SALES) || []) as (Omit<SaleItem, 'paymentStatus'> & { 
      amountRemaining?: number; 
      amountPaid?: number; 
      paymentStatus?: string; 
    })[];
    
    // --- SCENARIO A: EDITING A CREDIT (SALE) ---
    if (originalTransaction.type === 'credit' && originalTransaction.saleId) {
      const sale = sales.find(s => s.id === originalTransaction.saleId);
      if (sale) {
        const amountPaid = sale.amountPaid || 0;
        
        // CHECK 1: Cannot set credit amount less than what's already paid
        if (newAmount < amountPaid) {
          alert(`The new credit amount (Rs ${newAmount.toLocaleString('en-PK')}) cannot be less than the amount already paid (Rs ${amountPaid.toLocaleString('en-PK')}).`);
          setEditingTransactionId(null);
          return;
        }
        
        sale.totalAmount = newAmount;
        sale.date = new Date(editTransDate);
        sale.amountRemaining = newAmount - amountPaid;
        
        // Update payment status (Fixed Logic)
        if (sale.amountRemaining <= 0) {
            sale.amountRemaining = 0;
            sale.paymentStatus = 'paid';
        } else if (amountPaid > 0) {
            sale.paymentStatus = 'partial';
        } else {
            sale.paymentStatus = 'pending';
        }
      }
    } 
    // --- SCENARIO B: EDITING A PAYMENT ---
    else if (originalTransaction.type === 'payment') {
       
       const balanceBefore = getBalanceBefore(originalTransaction.id, originalTransaction.customerId, credits);
       if (newAmount > balanceBefore) {
            alert(`The new payment amount (Rs ${newAmount.toLocaleString('en-PK')}) cannot exceed the customer's outstanding debt immediately prior to this transaction.`);
            setEditingTransactionId(null);
            return;
       }

       const diff = newAmount - originalTransaction.amount;
       
       if (diff !== 0) {
           // Update Shop Account
           const accounts: Account[] = storage.get(STORAGE_KEYS.ACCOUNTS) || [];
           const shopAccount = accounts.find(a => a.type === 'shop');
           if (shopAccount) {
             shopAccount.balance += diff;
             storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
           }

           // Update Sales Records (Reconciliation)
           if (diff > 0) {
             // Added money: Distribute to oldest unpaid
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
             // Removed money: Revert from newest paid
             let moneyToTakeBack = Math.abs(diff);
             const paidSales = sales
                .filter(s => s.customerId === originalTransaction.customerId && (s.amountPaid || 0) > 0)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest first

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
    // FIX: Removed !editPhone.trim() check
    if (!selectedCustomer || !editName.trim()) {
      alert('Please enter a customer name');
      return;
    }

    const updatedCustomers = customers.map(c => 
      c.id === selectedCustomer.id 
        ? { ...c, name: editName.trim(), phone: editPhone.trim() }
        : c
    );

    // Update names in credits too
    const updatedCredits = credits.map(c => 
      c.customerId === selectedCustomer.id 
        ? { ...c, customerName: editName.trim() }
        : c
    );

    // Update names in sales too (Sync Requirement)
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
    
    setSelectedCustomer({
      ...selectedCustomer,
      name: editName.trim(),
      phone: editPhone.trim()
    });
  };

  const handleDeleteCustomer = () => {
    if (!selectedCustomer) return;
    if (selectedCustomer.pendingAmount > 0) {
      alert('Cannot delete customer with pending payments. Please clear all payments first.');
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

  const customerSummary = customers.map(customer => {
    const customerCredits = credits.filter(c => c.customerId === customer.id);
    
    const totalDebt = customerCredits
      .filter(c => c.type === 'credit')
      .reduce((sum, c) => sum + c.amount, 0);
      
    const totalPaid = customerCredits
      .filter(c => c.type === 'payment')
      .reduce((sum, c) => sum + c.amount, 0);

    const pendingAmount = totalDebt - totalPaid;
    
    const overdueAmount = customerCredits
      .filter(c => c.type === 'credit' && c.status === 'overdue')
      .reduce((sum, c) => sum + c.amount, 0);

    return {
      ...customer,
      pendingAmount: Math.max(0, pendingAmount), 
      overdueAmount,
      transactionCount: customerCredits.length
    };
  }).filter(c => c.transactionCount > 0);

  const getCustomerHistory = (customerId: string) => {
    const customerCredits = credits
      .filter(c => c.customerId === customerId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    
    return customerCredits.map(record => {
      const isPayment = record.type === 'payment';
      const amount = record.amount;
      
      if (isPayment) {
        runningBalance -= amount;
      } else {
        runningBalance += amount;
      }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Credit Management (Udhaar)</h1>
            <p className="text-slate-500 mt-1">Monitor pending payments and customer history.</p>
          </div>
          {overdueCount > 0 && (
            <div className="bg-red-50 text-red-700 px-4 py-2.5 rounded-lg flex items-center gap-2 border border-red-200 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold text-sm">Action Needed: {overdueCount} Overdue Customer{overdueCount > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search customer by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 text-slate-900 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
            />
          </div>
          <button
            onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
            className={`px-6 py-3 rounded-lg font-medium transition-all shadow-sm whitespace-nowrap ${
              filter === 'overdue'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            {filter === 'overdue' ? 'Show All' : 'Filter Overdue'}
          </button>
        </div>

        {/* Customer Cards */}
        <div className="grid grid-cols-1 gap-4">
          {customerSummary
            .filter(customer => {
              const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                   customer.phone.includes(searchTerm);
              const matchesFilter = filter === 'all' || 
                                   (filter === 'overdue' && customer.overdueAmount > 0);
              return matchesSearch && matchesFilter;
            })
            .map(customer => {
              const isOverdue = customer.overdueAmount > 0;
              
              const lastPayment = credits
                .filter(c => c.customerId === customer.id && c.type === 'payment')
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              
              const lastPaymentDays = lastPayment 
                ? differenceInDays(new Date(), new Date(lastPayment.date))
                : null;

              return (
                <div
                  key={customer.id}
                  className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-6 border-l-4 ${
                    isOverdue ? 'border-l-red-500 bg-red-50/10' : 'border-l-blue-500'
                  }`}
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setEditName(customer.name);
                            setEditPhone(customer.phone);
                            setShowEditModal(true);
                          }}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="Edit Customer Details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <h3 className="text-lg font-bold text-slate-800">{customer.name}</h3>
                        {isOverdue && (
                          <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                            Overdue
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {customer.phone || 'No Phone'}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {lastPayment 
                            ? `Last Payment: ${format(new Date(lastPayment.date), 'dd/MM/yyyy')} (${lastPaymentDays} days ago)`
                            : 'No payments received yet'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Pending Balance</p>
                        <p className={`text-2xl font-bold ${
                          customer.pendingAmount > 0 ? 'text-slate-800' : 'text-green-600'
                        }`}>
                          Rs {customer.pendingAmount.toLocaleString('en-PK')}
                        </p>
                      </div>

                      <div className="flex gap-2">
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
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
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
                Try adjusting your search or filters.
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