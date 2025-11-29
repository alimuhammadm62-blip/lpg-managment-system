'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Calendar } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { SaleItem, Customer, PurchaseItem, ItemType, CreditTransaction, Account } from '@/lib/types';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';

interface SaleLineItem {
  id: string;
  itemType: ItemType | 'OTHER';
  customItemName: string;
  quantity: string;
  pricePerUnit: string;
}

export default function SalePage() {
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [filteredSales, setFilteredSales] = useState<SaleItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableItems, setAvailableItems] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    customerName: '',
    isCredit: false,
    customerId: '',
    customerPhone: '',
  });

  const getInitialLineItems = (): SaleLineItem[] => [
    { id: '1', itemType: 'BN', customItemName: '', quantity: '', pricePerUnit: '' },
    { id: '2', itemType: 'SN', customItemName: '', quantity: '', pricePerUnit: '' },
    { id: '3', itemType: 'C', customItemName: '', quantity: '', pricePerUnit: '' },
  ];

  const [lineItems, setLineItems] = useState<SaleLineItem[]>(getInitialLineItems());

  useEffect(() => {
    loadSales();
    loadCustomers();
    loadAvailableItems();
  }, []);

  useEffect(() => {
    filterSalesByDateRange();
  }, [sales, dateRange]);

  const filterSalesByDateRange = () => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate >= start && saleDate <= end;
    });

    setFilteredSales(filtered);
  };

  const loadSales = () => {
    const data = storage.get<SaleItem[]>(STORAGE_KEYS.SALES) || [];
    setSales(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const loadCustomers = () => {
    const data = storage.get<Customer[]>(STORAGE_KEYS.CUSTOMERS) || [];
    setCustomers(data);
  };

  const loadAvailableItems = () => {
    const purchases: PurchaseItem[] = storage.get(STORAGE_KEYS.PURCHASES) || [];
    const customItems = storage.get<string[]>(STORAGE_KEYS.CUSTOM_ITEMS) || [];
    
    const itemsInStock = new Set<string>();
    purchases.forEach(p => {
      if (p.remainingQuantity > 0) {
        if (p.itemType === 'OTHER' && p.customItemName) {
          itemsInStock.add(p.customItemName);
        }
      }
    });

    setAvailableItems(['BN', 'SN', 'C', 'BNS', 'SNS', 'CS', 'ABN', 'ASN', ...Array.from(itemsInStock), ...customItems]);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { 
      id: Date.now().toString(), 
      itemType: 'BN', 
      customItemName: '', 
      quantity: '', 
      pricePerUnit: '' 
    }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof SaleLineItem, value: string) => {
    setLineItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          if (field === 'itemType') {
            return { ...item, [field]: value as ItemType | 'OTHER' };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const purchases: PurchaseItem[] = storage.get(STORAGE_KEYS.PURCHASES) || [];
    const newSales: SaleItem[] = [];
    const purchasesCopy = [...purchases];

    // Process each line item
    for (const line of lineItems) {
      if (!line.quantity || !line.pricePerUnit) continue;

      const quantity = parseFloat(line.quantity);
      const pricePerUnit = parseFloat(line.pricePerUnit);

      // Deduct from inventory using FIFO
      let quantityToDeduct = quantity;
      
      const itemMatches = (p: PurchaseItem) => {
        if (line.itemType === 'OTHER') {
          return p.itemType === 'OTHER' && p.customItemName === line.customItemName;
        }
        return p.itemType === line.itemType;
      };

      // Sort by date (FIFO - oldest first)
      const sortedPurchases = purchasesCopy
        .filter(itemMatches)
        .filter(p => p.remainingQuantity > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (sortedPurchases.reduce((sum, p) => sum + p.remainingQuantity, 0) < quantityToDeduct) {
        alert(`Insufficient inventory for ${line.itemType === 'OTHER' ? line.customItemName : line.itemType}!`);
        return;
      }

      // Track which batches were used
      const batchesUsed: { batchId: string; quantity: number }[] = [];

for (const purchase of sortedPurchases) {
  if (quantityToDeduct <= 0) break;

  if (purchase.remainingQuantity >= quantityToDeduct) {
    purchase.remainingQuantity -= quantityToDeduct;
    batchesUsed.push({ batchId: purchase.batchNumber, quantity: quantityToDeduct });
    quantityToDeduct = 0;
  } else {
    batchesUsed.push({ batchId: purchase.batchNumber, quantity: purchase.remainingQuantity });
    quantityToDeduct -= purchase.remainingQuantity;
    purchase.remainingQuantity = 0;
  }
}


      // Create sale record
      const newSale: SaleItem = {
        id: `${Date.now()}-${Math.random()}`,
        date: new Date(formData.date),
        itemType: line.itemType,
        customItemName: line.itemType === 'OTHER' ? line.customItemName : undefined,
        quantity: quantity,
        pricePerUnit: pricePerUnit,
        totalAmount: quantity * pricePerUnit,
        isCredit: formData.isCredit,
        paymentStatus: formData.isCredit ? 'pending' : 'paid',
        customerId: formData.isCredit ? formData.customerId || `CUST-${Date.now()}` : undefined,
        customerName: formData.customerName || undefined,
        batchesUsed: batchesUsed
      };

      newSales.push(newSale);
    }

    // Save updated purchases
    storage.set(STORAGE_KEYS.PURCHASES, purchasesCopy);

    // Save sales
    const allSales = [...newSales, ...sales];
    storage.set(STORAGE_KEYS.SALES, allSales);
    setSales(allSales);

    // Handle credit and customer
    if (formData.isCredit && formData.customerName) {
      let customer = customers.find(c => c.id === formData.customerId);
      
      if (!customer) {
        customer = {
          id: newSales[0].customerId!,
          name: formData.customerName,
          phone: formData.customerPhone,
          address: '',
          totalCredit: 0,
          lastPurchaseDate: new Date(formData.date)
        };
        const updatedCustomers = [...customers, customer];
        storage.set(STORAGE_KEYS.CUSTOMERS, updatedCustomers);
        setCustomers(updatedCustomers);
      }

      // Create credit transactions for each sale
      const credits: CreditTransaction[] = storage.get(STORAGE_KEYS.CREDITS) || [];
      const newCredits = newSales.map(sale => ({
        id: `${Date.now()}-${Math.random()}`,
        customerId: customer!.id,
        customerName: customer!.name,
        saleId: sale.id,
        amount: sale.totalAmount,
        date: new Date(formData.date),
        dueDate: addDays(new Date(formData.date), 45),
        status: 'pending' as const
      }));
      storage.set(STORAGE_KEYS.CREDITS, [...credits, ...newCredits]);
    } else if (!formData.isCredit) {
      // Add to shop account for cash sales
      const accounts: Account[] = storage.get(STORAGE_KEYS.ACCOUNTS) || [];
      const shopAccount = accounts.find(a => a.type === 'shop');
      if (shopAccount) {
        const totalSaleAmount = newSales.reduce((sum, s) => sum + s.totalAmount, 0);
        shopAccount.balance += totalSaleAmount;
        storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
      }
    }

    // Reset form
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      customerName: '',
      isCredit: false,
      customerId: '',
      customerPhone: '',
    });
    setLineItems(getInitialLineItems());
    setShowModal(false);
    loadAvailableItems();
  };

  const handleCancel = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      customerName: '',
      isCredit: false,
      customerId: '',
      customerPhone: '',
    });
    setLineItems(getInitialLineItems());
    setShowModal(false);
  };

  const deleteSale = (id: string) => {
    if (confirm('Are you sure you want to delete this sale? Inventory will be restored.')) {
      const sale = sales.find(s => s.id === id);
      if (!sale) return;

      // Restore inventory
      const purchases: PurchaseItem[] = storage.get(STORAGE_KEYS.PURCHASES) || [];
      
      if (sale.batchesUsed && sale.batchesUsed.length > 0) {
  for (const batch of sale.batchesUsed) {
    const purchase = purchases.find(p =>
      p.batchNumber === batch.batchId &&
      (sale.itemType === 'OTHER'
        ? p.customItemName === sale.customItemName
        : p.itemType === sale.itemType)
    );

    if (purchase) {
      purchase.remainingQuantity += batch.quantity; // restore only what was actually used
    }
  }

      } else {
        // Fallback: add to most recent batch of same item type
        const itemMatches = (p: PurchaseItem) => {
          if (sale.itemType === 'OTHER') {
            return p.itemType === 'OTHER' && p.customItemName === sale.customItemName;
          }
          return p.itemType === sale.itemType;
        };

        const sortedPurchases = purchases
          .filter(itemMatches)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (sortedPurchases.length > 0) {
          sortedPurchases[0].remainingQuantity += sale.quantity;
        }
      }

      storage.set(STORAGE_KEYS.PURCHASES, purchases);

      // Remove from credits if credit sale
      if (sale.isCredit) {
        const credits: CreditTransaction[] = storage.get(STORAGE_KEYS.CREDITS) || [];
        const updatedCredits = credits.filter(c => c.saleId !== id);
        storage.set(STORAGE_KEYS.CREDITS, updatedCredits);
      } else {
        // Deduct from shop account for cash sales
        const accounts: Account[] = storage.get(STORAGE_KEYS.ACCOUNTS) || [];
        const shopAccount = accounts.find(a => a.type === 'shop');
        if (shopAccount) {
          shopAccount.balance -= sale.totalAmount;
          storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
        }
      }

      // Remove sale
      const updatedSales = sales.filter(s => s.id !== id);
      storage.set(STORAGE_KEYS.SALES, updatedSales);
      setSales(updatedSales);
      loadAvailableItems();
    }
  };

  const getTotalAmount = () => lineItems.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.pricePerUnit) || 0;
    return sum + qty * price;
  }, 0);

  const totalSalesValue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const cashSales = filteredSales.filter(s => !s.isCredit).reduce((sum, s) => sum + s.totalAmount, 0);
  const creditSales = filteredSales.filter(s => s.isCredit).reduce((sum, s) => sum + s.totalAmount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">Sales Management</h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4">
            <div className="flex flex-col items-center w-full sm:min-w-[200px] sm:w-auto">
              <p className="text-sm sm:text-base text-gray-900 font-semibold mb-1">Total Sales</p>
              <div className="bg-white shadow-lg rounded-xl px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 h-[60px] flex items-center justify-center w-full">
                <p className="text-xl sm:text-2xl font-bold text-blue-600">Rs {totalSalesValue.toLocaleString('en-PK')}</p>
              </div>
            </div>

            <div className="flex flex-col items-center w-full sm:min-w-[200px] sm:w-auto">
              <p className="text-sm sm:text-base text-gray-900 font-semibold mb-1">Cash Sales</p>
              <div className="bg-white shadow-lg rounded-xl px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 h-[60px] flex items-center justify-center w-full">
                <p className="text-xl sm:text-2xl font-bold text-green-600">Rs {cashSales.toLocaleString('en-PK')}</p>
              </div>
            </div>

            <div className="flex flex-col items-center w-full sm:min-w-[200px] sm:w-auto">
              <p className="text-sm sm:text-base text-gray-900 font-semibold mb-1">Credit Sales</p>
              <div className="bg-white shadow-lg rounded-xl px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 h-[60px] flex items-center justify-center w-full">
                <p className="text-xl sm:text-2xl font-bold text-orange-600">Rs {creditSales.toLocaleString('en-PK')}</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 h-[60px] w-full sm:min-w-[180px] sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              <span>Add Sale</span>
            </button>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-4 sm:py-5 flex justify-between items-center">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Add New Sale</h2>
                  <p className="text-blue-100 text-xs sm:text-sm mt-1">Enter sale details below</p>
                </div>
                <button 
                  onClick={handleCancel} 
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                  {/* Date & Customer Name */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Sale Date *</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Customer Name (Optional)</label>
                      <input
                        type="text"
                        value={formData.customerName}
                        onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                        placeholder="Enter customer name"
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Credit Sale Option */}
                  <div className="border-t-2 border-gray-200 pt-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="isCredit"
                        checked={formData.isCredit}
                        onChange={(e) => setFormData({ ...formData, isCredit: e.target.checked })}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="isCredit" className="text-sm sm:text-base font-semibold text-gray-700">
                        This is a credit sale (Udhaar)
                      </label>
                    </div>

                    {/* Credit Customer Details */}
                    {formData.isCredit && (
                      <div className="mt-4 p-4 bg-orange-50 rounded-xl border-2 border-orange-200">
                        <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-3">Customer Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">Existing Customer</label>
                            <select
                              value={formData.customerId}
                              onChange={(e) => {
                                const customer = customers.find(c => c.id === e.target.value);
                                if (customer) {
                                  setFormData({
                                    ...formData,
                                    customerId: customer.id,
                                    customerName: customer.name,
                                    customerPhone: customer.phone,
                                  });
                                } else {
                                  setFormData({ ...formData, customerId: '', customerPhone: '' });
                                }
                              }}
                              className="w-full px-3 py-2 sm:py-2.5 text-xs sm:text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                            >
                              <option value="">New Customer</option>
                              {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">Customer Name *</label>
                            <input
                              type="text"
                              value={formData.customerName}
                              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                              placeholder="Enter name"
                              className="w-full px-3 py-2 sm:py-2.5 text-xs sm:text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              required={formData.isCredit}
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">Phone Number</label>
                            <input
                              type="tel"
                              value={formData.customerPhone}
                              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                              placeholder="Enter phone"
                              className="w-full px-3 py-2 sm:py-2.5 text-xs sm:text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Items Section */}
                  <div className="border-t-2 border-gray-200 pt-4 sm:pt-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900">Sale Items</h3>
                      <button
                        type="button"
                        onClick={addLineItem}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-md w-full sm:w-auto justify-center"
                      >
                        <Plus className="w-4 h-4" />
                        Add Item
                      </button>
                    </div>

                    <div className="space-y-3">
                      {lineItems.map((line, index) => (
                        <div key={line.id} className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-all">
                          <div className="grid grid-cols-12 gap-2 sm:gap-3 items-end">
                            {/* Item Type/Name */}
                            <div className="col-span-12 sm:col-span-3">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Item</label>
                              <select
                                value={line.itemType === 'OTHER' ? line.customItemName : line.itemType}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (['BN', 'SN', 'C', 'BNS', 'SNS', 'CS', 'ABN', 'ASN'].includes(val)) {
                                    updateLineItem(line.id, 'itemType', val);
                                    updateLineItem(line.id, 'customItemName', '');
                                  } else {
                                    updateLineItem(line.id, 'itemType', 'OTHER');
                                    updateLineItem(line.id, 'customItemName', val);
                                  }
                                }}
                                className="w-full px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium"
                                required
                              >
                                <option value="">Select Item</option>
                                {availableItems.map(item => (
                                  <option key={item} value={item}>{item}</option>
                                ))}
                              </select>
                            </div>

                            {/* Quantity */}
                            <div className="col-span-6 sm:col-span-3">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity</label>
                              <input
                                type="number"
                                step="0.01"
                                value={line.quantity}
                                onChange={e => updateLineItem(line.id, 'quantity', e.target.value)}
                                placeholder="0"
                                className="w-full px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                                required
                              />
                            </div>

                            {/* Price per Unit */}
                            <div className="col-span-6 sm:col-span-3">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Price/Unit</label>
                              <input
                                type="number"
                                step="0.01"
                                value={line.pricePerUnit}
                                onChange={e => updateLineItem(line.id, 'pricePerUnit', e.target.value)}
                                placeholder="0.00"
                                className="w-full px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                                required
                              />
                            </div>

                            {/* Total */}
                            <div className="col-span-10 sm:col-span-2">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Total</label>
                              <div className="px-2 sm:px-3 py-2 sm:py-2.5 bg-blue-50 border-2 border-blue-200 rounded-lg text-center">
                                <span className="text-xs sm:text-sm font-bold text-blue-700">
                                  {((parseFloat(line.quantity) || 0) * (parseFloat(line.pricePerUnit) || 0)).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            </div>

                            {/* Delete Button */}
                            <div className="col-span-2 sm:col-span-1 flex items-end justify-center">
                              <button
                                type="button"
                                onClick={() => removeLineItem(line.id)}
                                disabled={lineItems.length === 1}
                                className={`p-2 sm:p-2.5 rounded-lg transition-all ${
                                  lineItems.length === 1 
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                                }`}
                                title={lineItems.length === 1 ? 'Cannot remove last item' : 'Remove item'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 px-4 sm:px-6 py-4 sm:py-5">
<div className="flex flex-col sm:flex-row justify-between items-center gap-4">
<div className="text-center sm:text-left w-full sm:w-auto">
<p className="text-xs sm:text-sm text-gray-500 font-medium mb-1">Grand Total</p>
<p className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-600">
Rs {getTotalAmount().toLocaleString('en-PK')}
</p>
</div>
<div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-full sm:w-auto px-6 sm:px-8 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transition-all"
                  >
                    Save Sale
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Sales History Table */}
    <div className="bg-white shadow-xl rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200">
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Sales History</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">View all your sales records</p>
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
        <div className="bg-blue-50 border-b border-blue-200 px-4 sm:px-6 py-4">
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
            <button
              onClick={() => {
                setDateRange({
                  startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                  endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
                });
              }}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              This Month
            </button>
            <button
              onClick={() => {
                setDateRange({
                  startDate: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
                  endDate: format(new Date(), 'yyyy-MM-dd')
                });
              }}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              This Year
            </button>
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Date</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Item</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Customer</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Qty</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Price/Unit</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Total</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Type</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 sm:px-6 py-8 sm:py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <Plus className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4 opacity-20" />
                    <p className="text-base sm:text-lg font-semibold">No sales recorded yet</p>
                    <p className="text-xs sm:text-sm mt-1">Click "Add Sale" to get started</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSales.map(s => (
                <tr key={s.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                    {format(new Date(s.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className="text-xs sm:text-sm font-semibold text-gray-900">
                      {s.itemType === 'OTHER' ? s.customItemName : s.itemType}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                    {s.customerName || '-'}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right font-medium text-gray-900">
                    {s.quantity}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right text-gray-900">
                    Rs {s.pricePerUnit.toLocaleString('en-PK')}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right font-bold text-gray-900">
                    Rs {s.totalAmount.toLocaleString('en-PK')}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      s.isCredit ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {s.isCredit ? 'Credit' : 'Cash'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => deleteSale(s.id)}
                      className="inline-flex items-center justify-center p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                      title="Delete sale"
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
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
);
}
