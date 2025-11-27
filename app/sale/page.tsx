// app/sale/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { SaleItem, Customer, PurchaseItem, ItemType, CreditTransaction, Account } from '@/lib/types';
import { format, addDays } from 'date-fns';

export default function SalePage() {
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableItems, setAvailableItems] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    itemType: 'BN' as ItemType | 'OTHER',
    customItemName: '',
    quantity: '',
    pricePerUnit: '',
    isCredit: false,
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerAddress: ''
  });

  useEffect(() => {
    loadSales();
    loadCustomers();
    loadAvailableItems();
  }, []);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Deduct from inventory using FIFO
    const purchases: PurchaseItem[] = storage.get(STORAGE_KEYS.PURCHASES) || [];
    let quantityToDeduct = parseFloat(formData.quantity);
    
    const itemMatches = (p: PurchaseItem) => {
      if (formData.itemType === 'OTHER') {
        return p.itemType === 'OTHER' && p.customItemName === formData.customItemName;
      }
      return p.itemType === formData.itemType;
    };

    // Sort by date (FIFO - oldest first)
    const sortedPurchases = purchases
      .filter(itemMatches)
      .filter(p => p.remainingQuantity > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sortedPurchases.reduce((sum, p) => sum + p.remainingQuantity, 0) < quantityToDeduct) {
      alert('Insufficient inventory for this sale!');
      return;
    }

    for (const purchase of sortedPurchases) {
      if (quantityToDeduct <= 0) break;

      if (purchase.remainingQuantity >= quantityToDeduct) {
        purchase.remainingQuantity -= quantityToDeduct;
        quantityToDeduct = 0;
      } else {
        quantityToDeduct -= purchase.remainingQuantity;
        purchase.remainingQuantity = 0;
      }
    }

    storage.set(STORAGE_KEYS.PURCHASES, purchases);

    // Create sale record
    const newSale: SaleItem = {
      id: Date.now().toString(),
      date: new Date(formData.date),
      itemType: formData.itemType,
      customItemName: formData.itemType === 'OTHER' ? formData.customItemName : undefined,
      quantity: parseFloat(formData.quantity),
      pricePerUnit: parseFloat(formData.pricePerUnit),
      totalAmount: parseFloat(formData.quantity) * parseFloat(formData.pricePerUnit),
      isCredit: formData.isCredit,
      paymentStatus: formData.isCredit ? 'pending' : 'paid',
      customerId: formData.isCredit ? formData.customerId || Date.now().toString() : undefined,
      customerName: formData.isCredit ? formData.customerName : undefined
    };

    const updatedSales = [newSale, ...sales];
    storage.set(STORAGE_KEYS.SALES, updatedSales);
    setSales(updatedSales);

    // Handle credit and customer
    if (formData.isCredit) {
      let customer = customers.find(c => c.id === formData.customerId);
      
      if (!customer) {
        customer = {
          id: newSale.customerId!,
          name: formData.customerName,
          phone: formData.customerPhone,
          address: formData.customerAddress,
          totalCredit: 0,
          lastPurchaseDate: new Date(formData.date)
        };
        const updatedCustomers = [...customers, customer];
        storage.set(STORAGE_KEYS.CUSTOMERS, updatedCustomers);
        setCustomers(updatedCustomers);
      }

      // Create credit transaction
      const credits: CreditTransaction[] = storage.get(STORAGE_KEYS.CREDITS) || [];
      const newCredit: CreditTransaction = {
        id: Date.now().toString(),
        customerId: customer.id,
        customerName: customer.name,
        saleId: newSale.id,
        amount: newSale.totalAmount,
        date: new Date(formData.date),
        dueDate: addDays(new Date(formData.date), 45),
        status: 'pending'
      };
      storage.set(STORAGE_KEYS.CREDITS, [...credits, newCredit]);
    } else {
      // Add to shop account for cash sales
      const accounts: Account[] = storage.get(STORAGE_KEYS.ACCOUNTS) || [];
      const shopAccount = accounts.find(a => a.type === 'shop');
      if (shopAccount) {
        shopAccount.balance += newSale.totalAmount;
        storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
      }
    }

    // Reset form
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      itemType: 'BN',
      customItemName: '',
      quantity: '',
      pricePerUnit: '',
      isCredit: false,
      customerId: '',
      customerName: '',
      customerPhone: '',
      customerAddress: ''
    });

    loadAvailableItems();
  };

  const deleteSale = (id: string) => {
    if (confirm('Are you sure you want to delete this sale? Inventory will not be restored.')) {
      const updatedSales = sales.filter(s => s.id !== id);
      storage.set(STORAGE_KEYS.SALES, updatedSales);
      setSales(updatedSales);
    }
  };

  const totalSalesValue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const cashSales = sales.filter(s => !s.isCredit).reduce((sum, s) => sum + s.totalAmount, 0);
  const creditSales = sales.filter(s => s.isCredit).reduce((sum, s) => sum + s.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Sales Management</h1>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-600">Total Sales</p>
            <p className="text-xl font-bold text-blue-600">Rs {totalSalesValue.toLocaleString('en-PK')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Cash Sales</p>
            <p className="text-xl font-bold text-green-600">Rs {cashSales.toLocaleString('en-PK')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Credit Sales</p>
            <p className="text-xl font-bold text-orange-600">Rs {creditSales.toLocaleString('en-PK')}</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-500 mr-2 mt-0.5" />
          <p className="text-blue-700">Sales automatically deduct from oldest inventory first (FIFO method)</p>
        </div>
      </div>

      {/* Add Sale Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Record New Sale</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
              <select
                value={formData.itemType === 'OTHER' ? formData.customItemName : formData.itemType}
                onChange={(e) => {
                  const val = e.target.value;
                  if (['BN', 'SN', 'C', 'BNS', 'SNS', 'CS', 'ABN', 'ASN'].includes(val)) {
                    setFormData({ ...formData, itemType: val as ItemType, customItemName: '' });
                  } else {
                    setFormData({ ...formData, itemType: 'OTHER', customItemName: val });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Item</option>
                {availableItems.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit (Rs)</label>
              <input
                type="number"
                step="0.01"
                value={formData.pricePerUnit}
                onChange={(e) => setFormData({ ...formData, pricePerUnit: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isCredit"
              checked={formData.isCredit}
              onChange={(e) => setFormData({ ...formData, isCredit: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isCredit" className="text-sm font-medium text-gray-700">
              This is a credit sale (Udhaar)
            </label>
          </div>

          {formData.isCredit && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Existing Customer</label>
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
                        customerAddress: customer.address
                      });
                    } else {
                      setFormData({ ...formData, customerId: '', customerName: '', customerPhone: '', customerAddress: '' });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">New Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  placeholder="Phone number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                  placeholder="Address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-300">
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                Rs {(parseFloat(formData.quantity || '0') * parseFloat(formData.pricePerUnit || '0')).toLocaleString('en-PK')}
              </p>
            </div>

            <button
              type="submit"
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Record Sale</span>
            </button>
          </div>
        </form>
      </div>

      {/* Sales History */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Sales History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price/Unit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.map(sale => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {format(new Date(sale.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {sale.itemType === 'OTHER' ? sale.customItemName : sale.itemType}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">{sale.quantity}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    Rs {sale.pricePerUnit.toLocaleString('en-PK')}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                    Rs {sale.totalAmount.toLocaleString('en-PK')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sale.isCredit ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {sale.isCredit ? 'Credit' : 'Cash'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {sale.customerName || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deleteSale(sale.id)}
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