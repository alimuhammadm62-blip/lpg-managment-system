'use client';

import React, { useState, useEffect } from 'react';
import { Plus, ArrowRightLeft, Trash2, Wallet, Building, Home, MinusCircle } from 'lucide-react';
import { storage, STORAGE_KEYS, initializeAccounts } from '@/lib/storage';
import type { Account, Transaction } from '@/lib/types';

const formatDate = (date: Date) => {
  const d = new Date(date);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
};

const formatDateInput = (date: Date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function FinancePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'expense' | 'transfer' | 'deposit'>('expense');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  
  const [expenseForm, setExpenseForm] = useState({
  date: formatDateInput(new Date()),
  amount: '',
  category: '',
  fromAccount: 'shop',
  description: ''
});

  const [transferForm, setTransferForm] = useState({
    date: formatDateInput(new Date()),
    amount: '',
    fromAccount: 'shop',
    toAccount: 'bank',
    description: ''
  });

  const [depositForm, setDepositForm] = useState({
    date: formatDateInput(new Date()),
    amount: '',
    toAccount: 'shop',
    description: ''
  });

  useEffect(() => {
    initializeAccounts();
    loadAccounts();
    loadTransactions();
  }, []);

  const loadAccounts = () => {
    const data = storage.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
    setAccounts(data);
  };

  const loadTransactions = () => {
    const data = storage.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS) || [];
    setTransactions(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const handleExpense = (e: React.FormEvent) => {
    e.preventDefault();
    
    const account = accounts.find(a => a.type === expenseForm.fromAccount);
    if (!account || account.balance < parseFloat(expenseForm.amount)) {
      alert('Insufficient balance in selected account!');
      return;
    }

    account.balance -= parseFloat(expenseForm.amount);

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      date: new Date(expenseForm.date),
      type: 'expense',
      amount: parseFloat(expenseForm.amount),
      category: expenseForm.category,
      fromAccount: expenseForm.fromAccount,
      description: expenseForm.description,
    };

    storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
    storage.set(STORAGE_KEYS.TRANSACTIONS, [newTransaction, ...transactions]);
    
    setTransactions([newTransaction, ...transactions]);
    setAccounts([...accounts]);
    
setExpenseForm({
  date: formatDateInput(new Date()),
  amount: '',
  category: '',
  fromAccount: 'shop',
  description: ''
});
};

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();

    if (transferForm.fromAccount === transferForm.toAccount) {
      alert('Cannot transfer to the same account!');
      return;
    }

    const fromAcc = accounts.find(a => a.type === transferForm.fromAccount);
    const toAcc = accounts.find(a => a.type === transferForm.toAccount);

    if (!fromAcc || fromAcc.balance < parseFloat(transferForm.amount)) {
      alert('Insufficient balance in source account!');
      return;
    }

    fromAcc.balance -= parseFloat(transferForm.amount);
    toAcc!.balance += parseFloat(transferForm.amount);

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      date: new Date(transferForm.date),
      type: 'transfer',
      amount: parseFloat(transferForm.amount),
      fromAccount: transferForm.fromAccount,
      toAccount: transferForm.toAccount,
      category: 'Transfer',
      description: transferForm.description || ''
    };

    storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
    storage.set(STORAGE_KEYS.TRANSACTIONS, [newTransaction, ...transactions]);
    
    setTransactions([newTransaction, ...transactions]);
    setAccounts([...accounts]);
    
    setTransferForm({
      date: formatDateInput(new Date()),
      amount: '',
      fromAccount: 'shop',
      toAccount: 'bank',
      description: ''
    });
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();

    const account = accounts.find(a => a.type === depositForm.toAccount);
    if (!account) return;

    account.balance += parseFloat(depositForm.amount);

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      date: new Date(depositForm.date),
      type: 'deposit',
      amount: parseFloat(depositForm.amount),
      toAccount: depositForm.toAccount,
      category: 'deposit',
      description: depositForm.description
    };

    storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
    storage.set(STORAGE_KEYS.TRANSACTIONS, [newTransaction, ...transactions]);
    
    setTransactions([newTransaction, ...transactions]);
    setAccounts([...accounts]);
    
    setDepositForm({
      date: formatDateInput(new Date()),
      amount: '',
      toAccount: 'shop',
      description: ''
    });
  };

  const deleteTransaction = (id: string) => {
    if (confirm('Are you sure you want to delete this transaction? Account balances will be adjusted.')) {
      const txToDelete = transactions.find(t => t.id === id);
      if (!txToDelete) return;

      // Reverse the transaction impact on accounts
      if (txToDelete.type === 'expense') {
        const account = accounts.find(a => a.type === txToDelete.fromAccount);
        if (account) account.balance += txToDelete.amount;
      } else if (txToDelete.type === 'deposit') {
        const account = accounts.find(a => a.type === txToDelete.toAccount);
        if (account) account.balance -= txToDelete.amount;
      } else if (txToDelete.type === 'transfer') {
        const fromAcc = accounts.find(a => a.type === txToDelete.fromAccount);
        const toAcc = accounts.find(a => a.type === txToDelete.toAccount);
        if (fromAcc) fromAcc.balance += txToDelete.amount;
        if (toAcc) toAcc.balance -= txToDelete.amount;
      }

      const updated = transactions.filter(t => t.id !== id);
      storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
      storage.set(STORAGE_KEYS.TRANSACTIONS, updated);
      setAccounts([...accounts]);
      setTransactions(updated);
    }
  };

  const getAccountIcon = (type: string) => {
    const icons = {
      shop: { Icon: Wallet, color: 'bg-blue-600', lightColor: 'bg-blue-100', textColor: 'text-blue-600' },
      home: { Icon: Home, color: 'bg-purple-600', lightColor: 'bg-purple-100', textColor: 'text-purple-600' },
      bank: { Icon: Building, color: 'bg-emerald-600', lightColor: 'bg-emerald-100', textColor: 'text-emerald-600' },
      equity: { Icon: Wallet, color: 'bg-amber-600', lightColor: 'bg-amber-100', textColor: 'text-amber-600' }
    };
    return icons[type as keyof typeof icons] || icons.shop;
  };

  const filteredTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    if (dateRange.startDate && new Date(dateRange.startDate) > txDate) return false;
    if (dateRange.endDate && new Date(dateRange.endDate) < txDate) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Finance & Accounts</h1>
          <p className="text-slate-500 mt-1">Manage cash flow across Shop, Home, Bank, and Equity accounts.</p>
        </div>

        {/* Account Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {accounts.map(account => {
            const { Icon, color, lightColor, textColor } = getAccountIcon(account.type);
            return (
              <div key={account.id} className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all border-t-4 ${color.replace('bg-', 'border-t-')}`}>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 ${lightColor} rounded-lg ${textColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-slate-700">{account.name}</h3>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">
                    Rs {account.balance.toLocaleString('en-PK')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transaction Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h3 className="font-bold text-lg text-slate-800">Record Transaction</h3>
              </div>

              {/* Tab Selector */}
              <div className="px-6 pt-4">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    onClick={() => setActiveTab('expense')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      activeTab === 'expense' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    onClick={() => setActiveTab('transfer')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      activeTab === 'transfer' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Transfer
                  </button>
                  <button
                    onClick={() => setActiveTab('deposit')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      activeTab === 'deposit' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Deposit
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Expense Form */}
                {activeTab === 'expense' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={expenseForm.description}
                        onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                        placeholder="e.g., Shop Rent, Electricity..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">From Account</label>
                      <select
                        value={expenseForm.fromAccount}
                        onChange={(e) => setExpenseForm({ ...expenseForm, fromAccount: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.type}>{acc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <button
                      onClick={handleExpense}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-red-500/30"
                    >
                      <MinusCircle className="w-4 h-4" />
                      <span>Record Expense</span>
                    </button>
                  </div>
                )}

                {/* Transfer Form */}
                {activeTab === 'transfer' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={transferForm.amount}
                        onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={transferForm.description}
                        onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                        placeholder="Purpose of transfer"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">From Account</label>
                      <select
                        value={transferForm.fromAccount}
                        onChange={(e) => setTransferForm({ ...transferForm, fromAccount: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.type}>{acc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">To Account</label>
                      <select
                        value={transferForm.toAccount}
                        onChange={(e) => setTransferForm({ ...transferForm, toAccount: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        {accounts.filter(a => a.type !== transferForm.fromAccount).map(acc => (
                          <option key={acc.id} value={acc.type}>{acc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={transferForm.date}
                        onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <button
                      onClick={handleTransfer}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-blue-500/30"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Transfer Funds</span>
                    </button>
                  </div>
                )}

                {/* Deposit Form */}
                {activeTab === 'deposit' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={depositForm.amount}
                        onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={depositForm.description}
                        onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })}
                        placeholder="Brief description"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">To Account</label>
                      <select
                        value={depositForm.toAccount}
                        onChange={(e) => setDepositForm({ ...depositForm, toAccount: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.type}>{acc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={depositForm.date}
                        onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <button
                      onClick={handleDeposit}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-green-500/30"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Money</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transaction Log */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-lg text-slate-800">Recent Transactions</h3>
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Start Date"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="End Date"
                  />
                  {(dateRange.startDate || dateRange.endDate) && (
                    <button
                      onClick={() => setDateRange({ startDate: '', endDate: '' })}
                      className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          {dateRange.startDate || dateRange.endDate 
                            ? 'No transactions found in the selected date range.' 
                            : 'No transactions yet. Start by recording an expense or transfer.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-slate-500">
                            {formatDate(new Date(tx.date))}
                          </td>
                          <td className="py-3 px-4 font-medium">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                tx.type === 'deposit' ? 'bg-green-500' : 
                                tx.type === 'expense' ? 'bg-red-500' : 
                                'bg-blue-500'
                              }`}></span>
                              {tx.description}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {tx.type === 'transfer' 
                              ? `${tx.fromAccount} → ${tx.toAccount}`
                              : tx.fromAccount || tx.toAccount}
                          </td>
                          <td className={`py-3 px-4 text-right font-bold ${
                            tx.type === 'deposit' ? 'text-green-600' : 
                            tx.type === 'expense' ? 'text-red-600' : 
                            'text-slate-800'
                          }`}>
                            {tx.type === 'expense' ? '-' : ''}Rs {tx.amount.toLocaleString('en-PK')}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => deleteTransaction(tx.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}