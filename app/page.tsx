'use client';

import { useEffect, useState } from 'react';
import { CreditCard, ShoppingCart, TrendingUp, DollarSign, Percent, Wallet, PieChart, AlertTriangle, CheckCircle, Printer, Download } from 'lucide-react';
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

  const [overdueCustomers, setOverdueCustomers] = useState<Array<{
    name: string;
    amount: number;
    daysOverdue: number;
  }>>([]);

  const [expenseBreakdown, setExpenseBreakdown] = useState({
    shopExpense: 0,
    ownersEquity: 0,
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

    // Expense Breakdown
    const shopExpense = transactions
      .filter(t => t.type === 'expense' && t.category !== 'owner')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const ownersEquity = transactions
      .filter(t => t.type === 'expense' && t.category === 'owner')
      .reduce((sum, t) => sum + t.amount, 0);

    setExpenseBreakdown({ shopExpense, ownersEquity });

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
    const overdueList = credits
      .filter(c => c.status === 'overdue')
      .map(c => {
        const dueDate = new Date(c.dueDate);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          name: c.customerName,
          amount: c.amount,
          daysOverdue,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 5);

    setOverdueCustomers(overdueList);

    setStats({
      grossProfit,
      netSales,
      totalExpense,
      netProfit,
      averageDailySales,
      totalInventoryValue,
      pendingCredits,
      overdueCredits: overdueList.length,
    });
  };

  const grossMargin = stats.netSales > 0 ? (stats.grossProfit / stats.netSales) * 100 : 0;
  const netMargin = stats.netSales > 0 ? (stats.netProfit / stats.netSales) * 100 : 0;
  const shopExpensePercentage = stats.totalExpense > 0 ? (expenseBreakdown.shopExpense / stats.totalExpense) * 100 : 0;
  const ownersEquityPercentage = stats.totalExpense > 0 ? (expenseBreakdown.ownersEquity / stats.totalExpense) * 100 : 0;

  return (
    <main className="flex-1 px-4 md:px-8 py-8 w-full max-w-[1440px] mx-auto bg-[#f8f9fa]">
      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black leading-tight tracking-tight">Financial Summary</h1>
          <p className="text-[#64748b] text-base font-normal">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center justify-center rounded-lg h-10 px-4 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition border border-slate-200 shadow-sm">
            <Printer className="w-4 h-4 mr-2" />
            <span>Print</span>
          </button>
          <button className="flex items-center justify-center rounded-lg h-10 px-4 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition border border-slate-200 shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {stats.overdueCredits > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-6 flex items-center">
          <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
          <p className="text-red-700 font-medium">
            Alert: {stats.overdueCredits} customer(s) have overdue payments
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="flex flex-col gap-2 rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#64748b] text-sm font-medium uppercase tracking-wider">Pending Credits</p>
            <CreditCard className="w-5 h-5 text-[#64748b]" />
          </div>
          <div className="flex items-end gap-3 mt-1">
            <p className="text-slate-900 text-2xl font-bold leading-tight">Rs {stats.pendingCredits.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#64748b] text-sm font-medium uppercase tracking-wider">Gross Sale</p>
            <ShoppingCart className="w-5 h-5 text-[#64748b]" />
          </div>
          <div className="flex items-end gap-3 mt-1">
            <p className="text-slate-900 text-2xl font-bold leading-tight">Rs {stats.netSales.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#64748b] text-sm font-medium uppercase tracking-wider">Gross Profit</p>
            <TrendingUp className="w-5 h-5 text-[#64748b]" />
          </div>
          <div className="flex items-end gap-3 mt-1">
            <p className="text-slate-900 text-2xl font-bold leading-tight">Rs {stats.grossProfit.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl p-5 bg-white border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-[#19a1e6]/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start relative z-10">
            <p className="text-[#64748b] text-sm font-medium uppercase tracking-wider">Gross Margin</p>
            <Percent className="w-5 h-5 text-[#64748b]" />
          </div>
          <div className="flex items-end gap-3 mt-1 relative z-10">
            <p className="text-slate-900 text-2xl font-bold leading-tight">{grossMargin.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="flex flex-col gap-2 rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#64748b] text-sm font-medium uppercase tracking-wider">Gross Cost</p>
            <DollarSign className="w-5 h-5 text-[#64748b]" />
          </div>
          <div className="flex items-end gap-3 mt-1">
            <p className="text-slate-900 text-2xl font-bold leading-tight">Rs {(stats.netSales - stats.grossProfit).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#64748b] text-sm font-medium uppercase tracking-wider">Total Expenses</p>
            <DollarSign className="w-5 h-5 text-[#64748b]" />
          </div>
          <div className="flex items-end gap-3 mt-1">
            <p className="text-slate-900 text-2xl font-bold leading-tight">Rs {stats.totalExpense.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#64748b] text-sm font-medium uppercase tracking-wider">Net Profit / Loss</p>
            <Wallet className="w-5 h-5 text-[#19a1e6]" />
          </div>
          <div className="flex items-end gap-3 mt-1">
            <p className={`text-2xl font-bold leading-tight ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Rs {stats.netProfit.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl p-5 bg-white border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-[#0bda57]/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start relative z-10">
            <p className="text-[#64748b] text-sm font-medium uppercase tracking-wider">Net Margin</p>
            <PieChart className="w-5 h-5 text-[#64748b]" />
          </div>
          <div className="flex items-end gap-3 mt-1 relative z-10">
            <p className="text-slate-900 text-2xl font-bold leading-tight">{netMargin.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-between min-h-[420px]">
          <div className="w-full flex justify-between items-start">
            <div className="flex flex-col">
              <h3 className="text-slate-900 text-lg font-bold">Total Expenses</h3>
              <p className="text-[#64748b] text-sm">Breakdown by category</p>
            </div>
          </div>
          <div className="relative flex items-center justify-center my-6">
            <div 
              className="w-48 h-48 rounded-full bg-slate-50 relative flex items-center justify-center shadow-lg" 
              style={{ 
                background: stats.totalExpense > 0 
                  ? `conic-gradient(#fb923c 0% ${shopExpensePercentage}%, #a855f7 ${shopExpensePercentage}% 100%)` 
                  : '#e2e8f0'
              }}
            >
              <div className="w-36 h-36 bg-white rounded-full flex flex-col items-center justify-center z-10 shadow-inner">
                <span className="text-[#64748b] text-xs font-medium uppercase tracking-wider">Total</span>
                <span className="text-slate-900 text-3xl font-bold mt-1">Rs {stats.totalExpense.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
          <div className="w-full grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="w-3 h-3 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]"></span>
              <div className="flex flex-col">
                <span className="text-slate-900 text-sm font-bold">Shop Expense</span>
                <span className="text-xs text-[#64748b]">{shopExpensePercentage.toFixed(0)}% (Rs {expenseBreakdown.shopExpense.toLocaleString('en-PK', { maximumFractionDigits: 0 })})</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]"></span>
              <div className="flex flex-col">
                <span className="text-slate-900 text-sm font-bold">Owners Equity</span>
                <span className="text-xs text-[#64748b]">{ownersEquityPercentage.toFixed(0)}% (Rs {expenseBreakdown.ownersEquity.toLocaleString('en-PK', { maximumFractionDigits: 0 })})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm flex flex-col gap-6 min-h-[420px]">
          <div className="flex justify-between items-start">
            <h3 className="text-slate-900 text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#fa5f38]" />
              Overdue Payments
            </h3>
          </div>
          <div className="bg-white p-5 rounded-lg border border-slate-200 flex justify-between items-end shadow-sm">
            <div>
              <p className="text-[#64748b] text-sm font-medium mb-1">Total Pending Credit</p>
              <p className="text-slate-900 text-4xl font-black tracking-tight">Rs {stats.pendingCredits.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
            </div>
            {stats.overdueCredits > 0 && (
              <div className="flex items-center gap-1 text-[#fa5f38] bg-[#fa5f38]/10 px-2 py-1 rounded text-xs font-bold">
                <AlertTriangle className="w-3 h-3" />
                Action Needed
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {overdueCustomers.length > 0 ? (
              overdueCustomers.map((customer, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition group">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-white flex items-center justify-center border border-slate-200 group-hover:border-[#19a1e6]/50 transition shadow-sm">
                      <span className="text-[#64748b] font-bold text-xs">{customer.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-slate-900 text-sm font-bold">{customer.name}</p>
                      <p className="text-[#fa5f38] text-xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#fa5f38]"></span> Overdue {customer.daysOverdue} days
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-900 font-bold">Rs {customer.amount.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[#64748b]">
                <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">No overdue payments</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Summary</h2>
        <div className="space-y-3 text-gray-700">
          <p>• Your business generated <strong>Rs {stats.netSales.toLocaleString('en-PK')}</strong> in total sales</p>
          <p>• After deducting cost of goods (Rs {(stats.netSales - stats.grossProfit).toLocaleString('en-PK')}), gross profit is <strong>Rs {stats.grossProfit.toLocaleString('en-PK')}</strong></p>
          <p>• Total expenses amount to <strong>Rs {stats.totalExpense.toLocaleString('en-PK')}</strong></p>
          <p>• Your net profit is <strong className={stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>Rs {stats.netProfit.toLocaleString('en-PK')}</strong></p>
          <p>• Average daily sales over the last 30 days: <strong>Rs {stats.averageDailySales.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</strong></p>
          <p>• Current inventory value: <strong>Rs {stats.totalInventoryValue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</strong></p>
        </div>
      </div>
    </main>
  );
}
