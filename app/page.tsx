'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, AlertTriangle, Package } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { DashboardStats, SaleItem, Transaction, CreditTransaction, PurchaseItem } from '@/lib/types';
import { format, subDays, isWithinInterval } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    grossProfit: 0,
    netSales: 0,
    totalExpense: 0,
    netProfit: 0,
    averageDailySales: 0,
    totalInventoryValue: 0,
    pendingCredits: 0,
    overdueCredits: 0,
  });

  useEffect(() => {
    calculateStats();
  }, []);

  const calculateStats = () => {
    const sales: SaleItem[] = storage.get(STORAGE_KEYS.SALES) || [];
    const purchases: PurchaseItem[] = storage.get(STORAGE_KEYS.PURCHASES) || [];
    const transactions: Transaction[] = storage.get(STORAGE_KEYS.TRANSACTIONS) || [];
    const credits: CreditTransaction[] = storage.get(STORAGE_KEYS.CREDITS) || [];

    // Net Sales (total revenue)
    const netSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);

    // Total Cost of Goods Sold
    const totalCOGS = purchases.reduce((sum, purchase) => {
      const soldQuantity = purchase.quantity - purchase.remainingQuantity;
      return sum + (soldQuantity * purchase.pricePerUnit);
    }, 0);

    // Gross Profit = Revenue - COGS
    const grossProfit = netSales - totalCOGS;

    // Total Expenses
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    // Net Profit = Gross Profit - Expenses
    const netProfit = grossProfit - totalExpense;

    // Average Daily Sales (last 30 days)
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentSales = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return isWithinInterval(saleDate, { start: thirtyDaysAgo, end: new Date() });
    });
    const recentSalesTotal = recentSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const averageDailySales = recentSalesTotal / 30;

    // Total Inventory Value
    const totalInventoryValue = purchases.reduce((sum, purchase) => {
      return sum + (purchase.remainingQuantity * purchase.pricePerUnit);
    }, 0);

    // Pending Credits
    const pendingCredits = credits
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0);

    // Overdue Credits
    const overdueCredits = credits.filter(c => c.status === 'overdue').length;

    setStats({
      grossProfit,
      netSales,
      totalExpense,
      netProfit,
      averageDailySales,
      totalInventoryValue,
      pendingCredits,
      overdueCredits,
    });
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    trend, 
    color 
  }: { 
    title: string; 
    value: string | number; 
    icon: any; 
    trend?: 'up' | 'down'; 
    color: string;
  }) => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? `Rs ${value.toLocaleString('en-PK', { maximumFractionDigits: 0 })}` : value}
          </h3>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {trend && (
        <div className="mt-2 flex items-center">
          {trend === 'up' ? (
            <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
          )}
          <span className={`text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? 'Increasing' : 'Decreasing'}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {stats.overdueCredits > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-700 font-medium">
              Alert: {stats.overdueCredits} customer(s) have overdue payments (45+ days)
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Net Sales"
          value={stats.netSales}
          icon={DollarSign}
          trend="up"
          color="bg-blue-600"
        />
        <StatCard
          title="Gross Profit"
          value={stats.grossProfit}
          icon={TrendingUp}
          color="bg-green-600"
        />
        <StatCard
          title="Total Expenses"
          value={stats.totalExpense}
          icon={TrendingDown}
          color="bg-red-600"
        />
        <StatCard
          title="Net Profit"
          value={stats.netProfit}
          icon={DollarSign}
          color="bg-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Avg Daily Sales (30 days)"
          value={stats.averageDailySales}
          icon={ShoppingBag}
          color="bg-indigo-600"
        />
        <StatCard
          title="Inventory Value"
          value={stats.totalInventoryValue}
          icon={Package}
          color="bg-orange-600"
        />
        <StatCard
          title="Pending Credits"
          value={stats.pendingCredits}
          icon={AlertTriangle}
          color="bg-yellow-600"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Summary</h2>
        <div className="space-y-3 text-gray-700">
          <p>• Your business generated <strong>Rs {stats.netSales.toLocaleString('en-PK')}</strong> in total sales</p>
          <p>• After deducting cost of goods (Rs {(stats.netSales - stats.grossProfit).toLocaleString('en-PK')}), gross profit is <strong>Rs {stats.grossProfit.toLocaleString('en-PK')}</strong></p>
          <p>• Total expenses amount to <strong>Rs {stats.totalExpense.toLocaleString('en-PK')}</strong></p>
          <p>• Your net profit is <strong className={stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>Rs {stats.netProfit.toLocaleString('en-PK')}</strong></p>
          <p>• Average daily sales over the last 30 days: <strong>Rs {stats.averageDailySales.toLocaleString('en-PK')}</strong></p>
        </div>
      </div>
    </div>
  );
}