// app/credit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Search, AlertTriangle, CheckCircle, Clock, User } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { CreditTransaction, Customer, Account } from '@/lib/types';
import { format, differenceInDays } from 'date-fns';

export default function CreditPage() {
  const [credits, setCredits] = useState<CreditTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');

  useEffect(() => {
    loadCredits();
    loadCustomers();
  }, []);

  const loadCredits = () => {
    const data = storage.get<CreditTransaction[]>(STORAGE_KEYS.CREDITS) || [];
    
    // Update status based on dates
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

  const markAsPaid = (creditId: string) => {
    const credit = credits.find(c => c.id === creditId);
    if (!credit) return;

    if (confirm(`Mark Rs ${credit.amount.toLocaleString('en-PK')} payment from ${credit.customerName} as received?`)) {
      credit.paymentDate = new Date();
      credit.status = 'paid';

      // Update shop account
      const accounts: Account[] = storage.get(STORAGE_KEYS.ACCOUNTS) || [];
      const shopAccount = accounts.find(a => a.type === 'shop');
      if (shopAccount) {
        shopAccount.balance += credit.amount;
        storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
      }

      storage.set(STORAGE_KEYS.CREDITS, credits);
      setCredits([...credits]);
    }
  };

  const getDaysPending = (credit: CreditTransaction) => {
    if (credit.status === 'paid' && credit.paymentDate) {
      return differenceInDays(new Date(credit.paymentDate), new Date(credit.date));
    }
    return differenceInDays(new Date(), new Date(credit.date));
  };

  const filteredCredits = credits.filter(credit => {
    const matchesSearch = credit.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || credit.status === filter;
    return matchesSearch && matchesFilter;
  });

  const totalPending = credits.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
  const totalOverdue = credits.filter(c => c.status === 'overdue').reduce((sum, c) => sum + c.amount, 0);
  const totalPaid = credits.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
  const overdueCount = credits.filter(c => c.status === 'overdue').length;

  // Group credits by customer
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Credit Management (Udhaar)</h1>
      </div>

      {overdueCount > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
            <div>
              <p className="text-red-700 font-bold text-lg">
                ALERT: {overdueCount} payment(s) overdue (45+ days)
              </p>
              <p className="text-red-600">
                Total overdue amount: Rs {totalOverdue.toLocaleString('en-PK')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending Credits</p>
              <p className="text-3xl font-bold text-orange-600">
                Rs {totalPending.toLocaleString('en-PK')}
              </p>
            </div>
            <Clock className="w-12 h-12 text-orange-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Overdue Credits</p>
              <p className="text-3xl font-bold text-red-600">
                Rs {totalOverdue.toLocaleString('en-PK')}
              </p>
            </div>
            <AlertTriangle className="w-12 h-12 text-red-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Paid Credits</p>
              <p className="text-3xl font-bold text-green-600">
                Rs {totalPaid.toLocaleString('en-PK')}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Customer Summary */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Customer Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Overdue Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transactions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customerSummary.map(customer => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <User className="w-5 h-5 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                        <div className="text-xs text-gray-500">{customer.address}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.phone}</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className={customer.pendingAmount > 0 ? 'font-semibold text-orange-600' : 'text-gray-400'}>
                      Rs {customer.pendingAmount.toLocaleString('en-PK')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className={customer.overdueAmount > 0 ? 'font-semibold text-red-600' : 'text-gray-400'}>
                      Rs {customer.overdueAmount.toLocaleString('en-PK')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">{customer.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex space-x-2">
            {(['all', 'pending', 'overdue', 'paid'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Credit Transactions */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Credit Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Days Pending</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCredits.map(credit => {
                const daysPending = getDaysPending(credit);
                return (
                  <tr key={credit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {format(new Date(credit.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {credit.customerName}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                      Rs {credit.amount.toLocaleString('en-PK')}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        daysPending > 45
                          ? 'bg-red-100 text-red-800'
                          : daysPending > 30
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {daysPending} days
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center ${
                        credit.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : credit.status === 'overdue'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {credit.status === 'paid' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {credit.status === 'overdue' && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {credit.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                        {credit.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {credit.paymentDate ? format(new Date(credit.paymentDate), 'MMM dd, yyyy') : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {credit.status !== 'paid' && (
                        <button
                          onClick={() => markAsPaid(credit.id)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}