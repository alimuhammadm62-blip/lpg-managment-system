'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  Package, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Layers,
  Eye,
  X
} from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { PurchaseItem, SaleItem, InventoryItem } from '@/lib/types';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfMonth, 
  endOfMonth, 
  isBefore,
  subMonths
} from 'date-fns';

// Extended SaleItem type to match sales page
type ExtendedSaleItem = SaleItem & {
  itemType: string;
  customItemName?: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  amountPaid?: number;
  amountRemaining?: number;
  paymentStatus?: 'paid' | 'pending' | 'partial';
  isCredit?: boolean;
  customerName?: string;
  customerId?: string;
};

export default function InventoryPage() {
  // --- State ---
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [sales, setSales] = useState<ExtendedSaleItem[]>([]);
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  
  // Modal State
  const [modalItem, setModalItem] = useState<{ key: string, name: string } | null>(null);

  // --- Data Loading ---
  useEffect(() => {
    loadInventory();
    const loadedPurchases = storage.get(STORAGE_KEYS.PURCHASES) || [];
    const loadedSales = storage.get(STORAGE_KEYS.SALES) || [];
    setPurchases(loadedPurchases);
    setSales(loadedSales);
  }, []);

  // --- Load Inventory (From Working Code) ---
  const loadInventory = () => {
    const purchases: PurchaseItem[] = storage.get(STORAGE_KEYS.PURCHASES) || [];
    
    // Group by item type and calculate totals
    const inventoryMap = new Map<string, InventoryItem>();

    purchases.forEach(purchase => {
      if (purchase.remainingQuantity > 0) {
        const key = purchase.itemType === 'OTHER' 
          ? `OTHER_${purchase.customItemName}` 
          : purchase.itemType;

        if (!inventoryMap.has(key)) {
          inventoryMap.set(key, {
            itemType: purchase.itemType,
            customItemName: purchase.customItemName,
            totalQuantity: 0,
            averageCost: 0,
            batches: []
          });
        }

        const item = inventoryMap.get(key)!;
        item.totalQuantity += purchase.remainingQuantity;
        item.batches.push(purchase);
      }
    });

    // Calculate average cost using FIFO batches
    inventoryMap.forEach(item => {
      const totalCost = item.batches.reduce((sum, batch) => 
        sum + (batch.remainingQuantity * batch.pricePerUnit), 0
      );
      item.averageCost = item.totalQuantity > 0 ? totalCost / item.totalQuantity : 0;
      // Sort batches by date (FIFO - oldest first)
      item.batches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    setInventory(Array.from(inventoryMap.values()));
  };

  // --- Helpers ---
  const getItemKey = (type: string, customName?: string) => {
    return type === 'OTHER' ? `OTHER_${customName || ''}` : type;
  };

  const getItemDisplayName = (item: InventoryItem) => {
    if (item.itemType === 'OTHER' && item.customItemName) {
      return item.customItemName;
    }
    return item.itemType;
  };

  // Calculate inventory value with special handling for item "C"
  const calculateItemValue = (item: InventoryItem) => {
    let totalValue = 0;
    item.batches.forEach(batch => {
      if (batch.itemType === 'C') {
        // For item "C": divide quantity by 43, then multiply by price
        totalValue += (batch.remainingQuantity / 43) * batch.pricePerUnit;
      } else {
        totalValue += batch.remainingQuantity * batch.pricePerUnit;
      }
    });
    return totalValue;
  };

  const getTotalInventoryValue = () => {
    return inventory.reduce((sum, item) => sum + calculateItemValue(item), 0);
  };

  // Sort inventory items in specific order: BN, SN, C, then others
  const getSortedInventory = () => {
    const priority = ['BN', 'SN', 'C'];
    return [...inventory].sort((a, b) => {
      const aIndex = priority.indexOf(a.itemType);
      const bIndex = priority.indexOf(b.itemType);
      
      // If both are in priority list, sort by their priority
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      // If only a is in priority, a comes first
      if (aIndex !== -1) return -1;
      // If only b is in priority, b comes first
      if (bIndex !== -1) return 1;
      // Both are not in priority, sort alphabetically
      return getItemDisplayName(a).localeCompare(getItemDisplayName(b));
    });
  };

  // --- Report Generation (For Main Table) ---
  const reportData = useMemo(() => {
    if (!inventory.length) return [];

    const periodStart = startOfDay(new Date(dateRange.startDate));
    const periodEnd = endOfDay(new Date(dateRange.endDate));

    const rows = inventory.map(item => {
      const key = getItemKey(item.itemType, item.customItemName);
      let openingStock = 0;
      let purchasedInPeriod = 0;
      let soldInPeriod = 0;

      // Calculate Opening Stock & Period Purchases
      if (purchases && purchases.length > 0) {
        purchases.forEach(p => {
          if (!p) return;
          const pKey = getItemKey(p.itemType, p.customItemName);
          if (pKey !== key) return;

          const pDate = new Date(p.date);
          
          if (isBefore(pDate, periodStart)) {
            openingStock += p.quantity;
          } else if (pDate >= periodStart && pDate <= periodEnd) {
            purchasedInPeriod += p.quantity;
          }
        });
      }

      // Calculate Sales - matching sales page structure
      if (sales && sales.length > 0) {
        sales.forEach(s => {
          if (!s) return;
          const sDate = new Date(s.date);
          
          // Match based on itemType and customItemName
          const saleMatches = s.itemType === 'OTHER' 
            ? (item.itemType === 'OTHER' && s.customItemName === item.customItemName)
            : s.itemType === item.itemType;
          
          if (!saleMatches) return;

          if (isBefore(sDate, periodStart)) {
            openingStock -= s.quantity;
          } else if (sDate >= periodStart && sDate <= periodEnd) {
            soldInPeriod += s.quantity;
          }
        });
      }

      const closingStock = openingStock + purchasedInPeriod - soldInPeriod;

      return {
        key,
        name: getItemDisplayName(item),
        openingStock,
        purchasedInPeriod,
        soldInPeriod,
        closingStock
      };
    });

    return rows.sort((a, b) => b.closingStock - a.closingStock);
  }, [inventory, purchases, sales, dateRange]);

  // --- Get Batches for Modal ---
  const getModalBatches = () => {
    if (!modalItem) return [];
    const item = inventory.find(inv => {
      const key = getItemKey(inv.itemType, inv.customItemName);
      return key === modalItem.key;
    });
    return item ? item.batches : [];
  };

  const modalBatches = getModalBatches();

  // Calculate batch value with special handling for item "C"
  const calculateBatchValue = (batch: PurchaseItem) => {
    if (batch.itemType === 'C') {
      return (batch.remainingQuantity / 43) * batch.pricePerUnit;
    }
    return batch.remainingQuantity * batch.pricePerUnit;
  };

  // Get cost per unit with special handling for item "C"
  const getCostPerUnit = (batch: PurchaseItem) => {
    if (batch.itemType === 'C') {
      return batch.pricePerUnit / 43;
    }
    return batch.pricePerUnit;
  };

  const handleYearChange = () => {
    setDateRange({
      startDate: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd')
    });
  };

  const sortedInventory = getSortedInventory();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header Section */}
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">Inventory Overview</h1>
        </div>

        {/* Summary Tabs - Matching Sale Page Style */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4">
          
          {/* Total Value Card - Always First */}
          <div className="flex flex-col items-center w-full sm:min-w-[200px] sm:w-auto">
            <p className="text-sm sm:text-base text-gray-900 font-semibold mb-1">Total Inventory Value</p>
            <div className="bg-white shadow-lg rounded-xl px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 h-[60px] flex items-center justify-center w-full">
              <p className="text-xl sm:text-2xl font-bold text-green-600">
                Rs {getTotalInventoryValue().toLocaleString('en-PK')}
              </p>
            </div>
          </div>

          {/* Stock Item Cards in specific order: BN, SN, C, then others */}
          {sortedInventory.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center w-full sm:min-w-[100px] sm:w-auto">
              <p className="text-sm sm:text-base text-gray-900 font-semibold mb-1">{getItemDisplayName(item)}</p>
              <div className="bg-white shadow-lg rounded-xl px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 h-[60px] flex items-center justify-center w-full">
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{item.totalQuantity}</p>
              </div>
            </div>
          ))}

          {inventory.length === 0 && (
            <div className="flex flex-col items-center w-full sm:min-w-[200px] sm:w-auto">
              <p className="text-sm sm:text-base text-gray-400 italic mb-1">No Items</p>
              <div className="bg-white shadow-lg rounded-xl px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 h-[60px] flex items-center justify-center w-full">
                <p className="text-xl sm:text-2xl font-bold text-gray-400">0</p>
              </div>
            </div>
          )}
        </div>

        {/* Main Report Section */}
        <div className="bg-white shadow-xl rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200">
          
          {/* Toolbar */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Stock Movement Report</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Track opening, purchases, sales, and closing stock</p>
            </div>
            
            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                <span>Filter by Date</span>
              </button>
            </div>
          </div>

          {/* Date Filter Panel */}
          {showDateFilter && (
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
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
                      handleYearChange();
                    } else {
                      const monthIndex = parseInt(value);
                      const currentMonth = new Date().getMonth();
                      const currentYear = new Date().getFullYear();
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
                  <option value="0">Jan</option>
                  <option value="1">Feb</option>
                  <option value="2">Mar</option>
                  <option value="3">Apr</option>
                  <option value="4">May</option>
                  <option value="5">Jun</option>
                  <option value="6">Jul</option>
                  <option value="7">Aug</option>
                  <option value="8">Sep</option>
                  <option value="9">Oct</option>
                  <option value="10">Nov</option>
                  <option value="11">Dec</option>
                  <option value="year">YEAR</option>
                </select>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Item Name</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Opening Stock
                    <div className="text-[10px] text-gray-400 font-normal capitalize">Start of period</div>
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-green-700 uppercase tracking-wider bg-green-50/50">
                    <div className="flex items-center justify-end gap-1">
                      Purchased
                      <TrendingUp className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-red-700 uppercase tracking-wider bg-red-50/50">
                    <div className="flex items-center justify-end gap-1">
                      Sold
                      <TrendingDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-900 uppercase tracking-wider bg-gray-50/30">
                    Closing Stock
                    <div className="text-[10px] text-gray-400 font-normal capitalize">End of period</div>
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.length > 0 ? (
                  reportData.map((row) => (
                    <tr key={row.key} className="hover:bg-blue-50 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Layers className="w-4 h-4" />
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-gray-900">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right font-medium text-gray-900">
                        {row.openingStock}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right text-green-600 bg-green-50/30 font-medium">
                        {row.purchasedInPeriod > 0 ? `+${row.purchasedInPeriod}` : '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right text-red-600 bg-red-50/30 font-medium">
                        {row.soldInPeriod > 0 ? `-${row.soldInPeriod}` : '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right bg-gray-50/30">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          row.closingStock > 0 
                            ? 'bg-gray-900 text-white' 
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {row.closingStock}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                         <button 
                           onClick={() => setModalItem({ key: row.key, name: row.name })}
                           className="inline-flex items-center justify-center p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                           title="View Batch Details"
                         >
                           <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                         </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 py-8 sm:py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Package className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4 opacity-20" />
                        <p className="text-base sm:text-lg font-semibold">No inventory movements found</p>
                        <p className="text-xs sm:text-sm mt-1">No data for this period</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-gray-50 px-4 sm:px-6 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
            <span>* Opening Stock based on historical transactions.</span>
            <span>FIFO method applied.</span>
          </div>
        </div>

        {/* Batch Details Modal */}
        {modalItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
              
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 sm:px-6 py-4 sm:py-5 flex justify-between items-center">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">{modalItem.name}</h2>
                  <p className="text-gray-300 text-xs sm:text-sm mt-1">Active Stock Batches</p>
                </div>
                <button 
                  onClick={() => setModalItem(null)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {/* Modal Content - Table */}
              <div className="overflow-y-auto flex-1 p-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-left">Date</th>
                      <th className="px-3 sm:px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-left">Batch #</th>
                      <th className="px-3 sm:px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-left">Supplier</th>
                      <th className="px-3 sm:px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Original</th>
                      <th className="px-3 sm:px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Remaining</th>
                      <th className="px-3 sm:px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Cost/Unit</th>
                      <th className="px-3 sm:px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Batch Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {modalBatches.length > 0 ? (
                      modalBatches.map((batch) => (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 whitespace-nowrap">
                            {format(new Date(batch.date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                            {batch.batchNumber || '-'}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                            {batch.supplier || 'N/A'}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right text-gray-500 whitespace-nowrap">
                            {batch.quantity}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              batch.remainingQuantity < batch.quantity * 0.2 
                                ? 'bg-red-100 text-red-600' 
                                : 'bg-green-100 text-green-600'
                            }`}>
                              {batch.remainingQuantity}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right text-gray-900 whitespace-nowrap">
                            Rs {getCostPerUnit(batch).toLocaleString('en-PK', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-right font-semibold text-gray-900 whitespace-nowrap">
                            Rs {calculateBatchValue(batch).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
                          No active stock batches found for this item.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {modalBatches.length > 0 && (
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={4} className="px-3 sm:px-6 py-3 text-xs sm:text-sm font-bold text-right text-gray-900">Totals:</td>
                        <td className="px-3 sm:px-6 py-3 text-xs sm:text-sm font-bold text-right text-gray-900 whitespace-nowrap">
                          {modalBatches.reduce((sum, b) => sum + b.remainingQuantity, 0)}
                        </td>
                        <td></td>
                        <td className="px-3 sm:px-6 py-3 text-xs sm:text-sm font-bold text-right text-gray-900 whitespace-nowrap">
                          Rs {modalBatches.reduce((sum, b) => sum + calculateBatchValue(b), 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}