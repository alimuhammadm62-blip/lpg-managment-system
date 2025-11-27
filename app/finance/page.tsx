// app/finance/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Plus, ArrowRightLeft, Trash2, Wallet } from 'lucide-react';
import { storage, STORAGE_KEYS, initializeAccounts } from '@/lib/storage';
import type { Account, Transaction } from '@/lib/types';
import { format } from 'date-fns';

export default function FinancePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'expense' | 'transfer' | 'deposit'>('expense');
  
  const [expenseForm, setExpenseForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    fromAccount: 'shop',
    category: '',
    description: ''
  });

  const [transferForm, setTransferForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    fromAccount: 'shop',
    toAccount: 'bank',
    description: ''
  });

  const [depositForm, setDepositForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    toAccount: 'shop',
    category: '',
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
      fromAccount: expenseForm.fromAccount,
      category: expenseForm.category,
      description: expenseForm.description
    };

    storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
    storage.set(STORAGE_KEYS.TRANSACTIONS, [newTransaction, ...transactions]);
    
    setTransactions([newTransaction, ...transactions]);
    setAccounts([...accounts]);
    
    setExpenseForm({
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      fromAccount: 'shop',
      category: '',
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
      description: transferForm.description
    };

    storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
    storage.set(STORAGE_KEYS.TRANSACTIONS, [newTransaction, ...transactions]);
    
    setTransactions([newTransaction, ...transactions]);
    setAccounts([...accounts]);
    
    setTransferForm({
      date: format(new Date(), 'yyyy-MM-dd'),
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
      category: depositForm.category,
      description: depositForm.description
    };

    storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
    storage.set(STORAGE_KEYS.TRANSACTIONS, [newTransaction, ...transactions]);
    
    setTransactions([newTransaction, ...transactions]);
    setAccounts([...accounts]);
    
    setDepositForm({
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      toAccount: 'shop',
      category: '',
      description: ''
    });
  };

  const deleteTransaction = (id: string) => {
    if (confirm('Are you sure? This will not restore account balances automatically.')) {
      const updated = transactions.filter(t => t.id !== id);
      storage.set(STORAGE_KEYS.TRANSACTIONS, updated);
      setTransactions(updated);
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  const getAccountIcon = (type: string) => {
    const colors = {
      shop: 'bg-blue-600',
      bank: 'bg-green-600',
      home: 'bg-purple-600'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Financial Management</h1>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Balance</p>
          <p className="text-2xl font-bold text-green-600">
            Rs {totalBalance.toLocaleString('en-PK')}
          </p>
        </div>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {accounts.map(account => (
          <div key={account.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className={`${getAccountIcon(account.type)} px-6 py-4 text-white`}>
              <div className="flex items-center space-x-2 mb-2">
                <Wallet className="w-5 h-5" />
                <h3 className="text-lg font-bold">{account.name}</h3>
              </div>
              <p className="text-3xl font-bold">
                Rs {account.balance.toLocaleString('en-PK')}
              </p>
            </div>
            <div className="px-6 py-3 bg-gray-50">
              <p className="text-xs text-gray-600 uppercase tracking-wide">{account.type} Account</p>
            </div>
          </div>
        ))}
      </div>

      {/* Transaction Forms */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <div className="flex">
            {(['expense', 'transfer', 'deposit'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'expense' && 'Record Expense'}
                {tab === 'transfer' && 'Transfer Money'}
                {tab === 'deposit' && 'Add Money'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'expense' && (
            <form onSubmit={handleExpense} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pay From</label>
                  <select
                    value={expenseForm.fromAccount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, fromAccount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.type}>
                        {acc.name} (Rs {acc.balance.toLocaleString('en-PK')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    placeholder="e.g., Rent, Utilities, Salary"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    list="expense-categories"
                  />
                  <datalist id="expense-categories">
                    <option value="Rent" />
                    <option value="Utilities" />
                    <option value="Salary" />
                    <option value="Transport" />
                    <option value="Maintenance" />
                    <option value="Supplies" />
                  </datalist>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    placeholder="Brief description of expense"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                <span>Record Expense</span>
              </button>
            </form>
          )}

          {activeTab === 'transfer' && (
            <form onSubmit={handleTransfer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={transferForm.date}
                    onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Account</label>
                  <select
                    value={transferForm.fromAccount}
                    onChange={(e) => setTransferForm({ ...transferForm, fromAccount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.type}>
                        {acc.name} (Rs {acc.balance.toLocaleString('en-PK')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Account</label>
                  <select
                    value={transferForm.toAccount}
                    onChange={(e) => setTransferForm({ ...transferForm, toAccount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {accounts.filter(a => a.type !== transferForm.fromAccount).map(acc => (
                      <option key={acc.id} value={acc.type}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 lg:col-span-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={transferForm.description}
                    onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                    placeholder="Purpose of transfer"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <ArrowRightLeft className="w-5 h-5" />
                <span>Transfer Money</span>
              </button>
            </form>
          )}

          {activeTab === 'deposit' && (
            <form onSubmit={handleDeposit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={depositForm.date}
                    onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={depositForm.amount}
                    onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add To</label>
                  <select
                    value={depositForm.toAccount}
                    onChange={(e) => setDepositForm({ ...depositForm, toAccount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.type}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <input
                    type="text"
                    value={depositForm.category}
                    onChange={(e) => setDepositForm({ ...depositForm, category: e.target.value })}
                    placeholder="e.g., Personal Investment, Loan"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={depositForm.description}
                    onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })}
                    placeholder="Brief description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                <span>Add Money</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From/To</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map(transaction => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {format(new Date(transaction.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      transaction.type === 'expense'
                        ? 'bg-red-100 text-red-800'
                        : transaction.type === 'deposit'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {transaction.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{transaction.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {transaction.type === 'transfer' 
                      ? `${transaction.fromAccount} → ${transaction.toAccount}`
                      : transaction.fromAccount || transaction.toAccount}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold">
                    <span className={
                      transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'
                    }>
                      {transaction.type === 'expense' ? '-' : '+'} Rs {transaction.amount.toLocaleString('en-PK')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{transaction.description}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deleteTransaction(transaction.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}