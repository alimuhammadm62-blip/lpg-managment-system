'use client';

import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, CheckCircle, Clock, User, X, Calendar, Edit2, Phone, Wallet, History } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { CreditTransaction, Customer, Account } from '@/lib/types';
import { format, differenceInDays } from 'date-fns';

export default function CreditPage() {
  const [credits, setCredits] = useState<CreditTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'overdue'>('all');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<typeof customerSummary[0] | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    loadCredits();
    loadCustomers();
  }, []);

  const loadCredits = () => {
    const data = storage.get<CreditTransaction[]>(STORAGE_KEYS.CREDITS) || [];
    
    const today = new Date();
    data.forEach(credit => {
      if (credit.status === 'pending') {
        const daysPending = differenceInDays(today, new Date(credit.date));
        if (daysPending > 45) {
          credit.status = 'overdue';
        }
      }
    });

    storage.set(STORAGE_KEYS.CREDITS, data);
    setCredits(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const loadCustomers = () => {
    const data = storage.get<Customer[]>(STORAGE_KEYS.CUSTOMERS) || [];
    setCustomers(data);
  };

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

    const unpaidCredits = credits.filter(
      c => c.customerId === selectedCustomer.id && c.status !== 'paid'
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let remainingAmount = amount;
    
    for (const credit of unpaidCredits) {
      if (remainingAmount <= 0) break;
      
      if (remainingAmount >= credit.amount) {
        credit.status = 'paid';
        credit.paymentDate = new Date(paymentDate);
        remainingAmount -= credit.amount;
      } else {
        credit.amount -= remainingAmount;
        
        const paidCredit: CreditTransaction = {
          ...credit,
          id: `${credit.id}-paid-${Date.now()}`,
          amount: remainingAmount,
          status: 'paid',
          paymentDate: new Date(paymentDate)
        };
        credits.push(paidCredit);
        remainingAmount = 0;
      }
    }

    const accounts: Account[] = storage.get(STORAGE_KEYS.ACCOUNTS) || [];
    const shopAccount = accounts.find(a => a.type === 'shop');
    if (shopAccount) {
      shopAccount.balance += amount;
      storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
    }

    storage.set(STORAGE_KEYS.CREDITS, credits);
    setCredits([...credits]);
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setSelectedCustomer(null);
  };

  const handleEditCustomer = () => {
    if (!selectedCustomer || !editName.trim() || !editPhone.trim()) {
      alert('Please enter customer name and phone number');
      return;
    }

    const customerIndex = customers.findIndex(c => c.id === selectedCustomer.id);
    if (customerIndex !== -1) {
      customers[customerIndex].name = editName.trim();
      customers[customerIndex].phone = editPhone.trim();
      
      credits.forEach(credit => {
        if (credit.customerId === selectedCustomer.id) {
          credit.customerName = editName.trim();
        }
      });

      storage.set(STORAGE_KEYS.CUSTOMERS, customers);
      storage.set(STORAGE_KEYS.CREDITS, credits);
      setCustomers([...customers]);
      setCredits([...credits]);
      setShowEditModal(false);
      setEditName('');
      setEditPhone('');
      
      setSelectedCustomer({
        ...selectedCustomer,
        name: editName.trim(),
        phone: editPhone.trim()
      });
    }
  };

  const handleDeleteCustomer = () => {
    if (!selectedCustomer) return;

    const hasUnpaidCredits = credits.some(
      c => c.customerId === selectedCustomer.id && c.status !== 'paid'
    );

    if (hasUnpaidCredits) {
      alert('Cannot delete customer with pending payments. Please clear all payments first.');
      return;
    }

    if (confirm(`Are you sure you want to delete ${selectedCustomer.name}? This will also delete all their transaction history.`)) {
      const updatedCustomers = customers.filter(c => c.id !== selectedCustomer.id);
      const updatedCredits = credits.filter(c => c.customerId !== selectedCustomer.id);

      storage.set(STORAGE_KEYS.CUSTOMERS, updatedCustomers);
      storage.set(STORAGE_KEYS.CREDITS, updatedCredits);
      setCustomers(updatedCustomers);
      setCredits(updatedCredits);
      setShowEditModal(false);
      setEditName('');
      setEditPhone('');
      setSelectedCustomer(null);
    }
  };

  const openHistoryModal = (customer: typeof customerSummary[0]) => {
    setSelectedCustomer(customer);
    setShowHistoryModal(true);
  };

  const openPaymentModal = (customer: typeof customerSummary[0]) => {
    setSelectedCustomer(customer);
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setShowPaymentModal(true);
  };

  const openEditModal = (customer: typeof customerSummary[0]) => {
    setSelectedCustomer(customer);
    setEditName(customer.name);
    setEditPhone(customer.phone);
    setShowEditModal(true);
  };

  const totalPending = credits.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
  const totalOverdue = credits.filter(c => c.status === 'overdue').reduce((sum, c) => sum + c.amount, 0);
  const overdueCount = credits.filter(c => c.status === 'overdue').length;

  const customerSummary = customers.map(customer => {
    const customerCredits = credits.filter(c => c.customerId === customer.id);
    const pendingAmount = customerCredits.filter(c => c.status !== 'paid').reduce((sum, c) => sum + c.amount, 0);
    const overdueAmount = customerCredits.filter(c => c.status === 'overdue').reduce((sum, c) => sum + c.amount, 0);
    return {
      ...customer,
      pendingAmount,
      overdueAmount,
      transactionCount: customerCredits.length
    };
  }).filter(c => c.transactionCount > 0);

const getCustomerHistory = (customerId: string) => {
  const customerCredits = credits.filter(c => c.customerId === customerId);

  let runningBalance = 0;
  const history: Array<{
    date: Date;
    type: string;
    credit: number;
    received: number;
    balance: number;
    sortDate: number;
  }> = [];
  
  for (const credit of customerCredits) {
    if (credit.status === 'paid' && credit.paymentDate) {
      // For paid credits, only show the payment (received), not the original credit
      runningBalance -= credit.amount;
      history.push({
        date: credit.paymentDate,
        type: 'payment',
        credit: 0,
        received: credit.amount,
        balance: runningBalance,
        sortDate: new Date(credit.paymentDate).getTime()
      });
    } else {
      // Unpaid credit - show in credit column
      runningBalance += credit.amount;
      history.push({
        date: credit.date,
        type: 'credit',
        credit: credit.amount,
        received: 0,
        balance: runningBalance,
        sortDate: new Date(credit.date).getTime()
      });
    }
  }
  
  return history.sort((a, b) => a.sortDate - b.sortDate);
};

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
              <span className="font-semibold text-sm">Action Needed: {overdueCount} Overdue Customer{overdueCount > 1 ? 's' : ''} (&gt;45 Days)</span>
            </div>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search customer by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-900 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
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
            Filter Overdue
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
              const lastTransaction = credits
                .filter(c => c.customerId === customer.id && c.status !== 'paid')
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
              
              const lastPaymentDays = lastTransaction 
                ? differenceInDays(new Date(), new Date(lastTransaction.date))
                : 0;

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
                          onClick={() => openEditModal(customer)}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <h3 className="text-lg font-bold text-slate-800">{customer.name}</h3>
                        {isOverdue && (
                          <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                            Overdue Alert
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {customer.phone}
                        </span>
                        <span>•</span>
                        <span>
                          Last Payment: {lastTransaction 
                            ? `${format(new Date(lastTransaction.date), 'dd/MM/yyyy')} (${lastPaymentDays} days ago)`
                            : 'No pending payments'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
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
                          onClick={() => openHistoryModal(customer)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          title="View History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openPaymentModal(customer)}
                          disabled={customer.pendingAmount === 0}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                            customer.pendingAmount === 0
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : isOverdue 
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          <Wallet className="w-4 h-4" />
                          <span>Receive Payment</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          
          {customerSummary.filter(customer => {
            const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 customer.phone.includes(searchTerm);
            const matchesFilter = filter === 'all' || 
                                 (filter === 'overdue' && customer.overdueAmount > 0);
            return matchesSearch && matchesFilter;
          }).length === 0 && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-800 mb-2">No customers found</h3>
              <p className="text-slate-500">
                {filter === 'overdue' 
                  ? 'No customers with overdue payments'
                  : 'No customers with pending credits match your search'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{selectedCustomer.name}</h2>
                <p className="text-blue-100 text-sm mt-1">Complete transaction history</p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-100px)]">
              <div className="bg-blue-50 rounded-xl p-5 mb-6 border border-blue-100">
                <p className="text-sm text-slate-600 mb-1">Current Balance</p>
                <p className="text-3xl font-bold text-blue-600">Rs {selectedCustomer.pendingAmount.toLocaleString('en-PK')}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Date</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Credit</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Received</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getCustomerHistory(selectedCustomer.id).map((record, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4 text-sm text-slate-800 font-medium">
                          {format(new Date(record.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="py-4 px-4 text-sm text-right">
                          {record.credit > 0 ? (
                            <span className="text-red-600 font-semibold">Rs {record.credit.toLocaleString('en-PK')}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm text-right">
                          {record.received > 0 ? (
                            <span className="text-green-600 font-semibold">Rs {record.received.toLocaleString('en-PK')}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm text-right font-bold text-slate-800">
                          Rs {Math.max(0, record.balance).toLocaleString('en-PK')}
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
                  Confirm Payment
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
              <p className="text-blue-100 text-sm mt-1">Update customer information</p>
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
                  placeholder="Enter customer name"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Enter phone number"
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
                    setEditName('');
                    setEditPhone('');
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