// app/purchase/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { PurchaseItem, ItemType } from '@/lib/types';
import { format } from 'date-fns';

const ITEM_TYPES: (ItemType | 'OTHER')[] = ['BN', 'SN', 'C', 'BNS', 'SNS', 'CS', 'ABN', 'ASN', 'OTHER'];

interface PurchaseLineItem {
  id: string;
  itemType: ItemType | 'OTHER';
  customItemName: string;
  quantity: string;
  pricePerUnit: string;
}

export default function PurchasePage() {
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    supplier: '',
  });

  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([
    { id: '1', itemType: 'BN', customItemName: '', quantity: '', pricePerUnit: '' }
  ]);

  useEffect(() => {
    loadPurchases();
    loadCustomItems();
  }, []);

  const loadPurchases = () => {
    const data = storage.get<PurchaseItem[]>(STORAGE_KEYS.PURCHASES) || [];
    setPurchases(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const loadCustomItems = () => {
    const items = storage.get<string[]>(STORAGE_KEYS.CUSTOM_ITEMS) || [];
    setCustomItems(items);
  };

  const generateBatchNumber = () => {
    const date = new Date();
    const timestamp = date.getTime();
    return `BATCH-${timestamp}`;
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

  const updateLineItem = (id: string, field: keyof PurchaseLineItem, value: string) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newPurchases: PurchaseItem[] = [];
    const updatedCustomItems = [...customItems];

    lineItems.forEach(line => {
      if (!line.quantity || !line.pricePerUnit) return;

      const newPurchase: PurchaseItem = {
        id: `${Date.now()}-${Math.random()}`,
        date: new Date(formData.date),
        itemType: line.itemType,
        customItemName: line.itemType === 'OTHER' ? line.customItemName : undefined,
        quantity: parseFloat(line.quantity),
        pricePerUnit: parseFloat(line.pricePerUnit),
        totalCost: parseFloat(line.quantity) * parseFloat(line.pricePerUnit),
        supplier: formData.supplier,
        batchNumber: generateBatchNumber(),
        remainingQuantity: parseFloat(line.quantity)
      };

      newPurchases.push(newPurchase);

      // Save custom item
      if (line.itemType === 'OTHER' && line.customItemName && !updatedCustomItems.includes(line.customItemName)) {
        updatedCustomItems.push(line.customItemName);
      }
    });

    const allPurchases = [...newPurchases, ...purchases];
    storage.set(STORAGE_KEYS.PURCHASES, allPurchases);
    storage.set(STORAGE_KEYS.CUSTOM_ITEMS, updatedCustomItems);
    
    setPurchases(allPurchases);
    setCustomItems(updatedCustomItems);

    // Reset form
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      supplier: '',
    });
    setLineItems([{ id: '1', itemType: 'BN', customItemName: '', quantity: '', pricePerUnit: '' }]);
    setShowModal(false);
  };

  const deletePurchase = (id: string) => {
    if (confirm('Are you sure you want to delete this purchase?')) {
      const updatedPurchases = purchases.filter(p => p.id !== id);
      storage.set(STORAGE_KEYS.PURCHASES, updatedPurchases);
      setPurchases(updatedPurchases);
    }
  };

  const totalPurchaseValue = purchases.reduce((sum, p) => sum + p.totalCost, 0);
  const getTotalAmount = () => {
    return lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.pricePerUnit) || 0;
      return sum + (qty * price);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Purchase Management</h1>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-gray-600">Total Purchases</p>
            <p className="text-2xl font-bold text-blue-600">
              Rs {totalPurchaseValue.toLocaleString('en-PK')}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>Add Purchase</span>
          </button>
        </div>
      </div>

      {/* Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-300 bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Add New Purchase</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="Supplier name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Items</h3>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {lineItems.map((line, index) => (
                    <div key={line.id} className="grid grid-cols-12 gap-3 items-start p-3 bg-gray-50 rounded-lg">
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Item Type</label>
                        <select
                          value={line.itemType}
                          onChange={(e) => updateLineItem(line.id, 'itemType', e.target.value)}
                          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          {ITEM_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>

                      {line.itemType === 'OTHER' && (
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Item Name</label>
                          <input
                            type="text"
                            value={line.customItemName}
                            onChange={(e) => updateLineItem(line.id, 'customItemName', e.target.value)}
                            placeholder="Item name"
                            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                            list="custom-items"
                          />
                          <datalist id="custom-items">
                            {customItems.map(item => (
                              <option key={item} value={item} />
                            ))}
                          </datalist>
                        </div>
                      )}

                      <div className={line.itemType === 'OTHER' ? 'col-span-2' : 'col-span-3'}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => updateLineItem(line.id, 'quantity', e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div className={line.itemType === 'OTHER' ? 'col-span-2' : 'col-span-3'}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Price/Unit</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.pricePerUnit}
                          onChange={(e) => updateLineItem(line.id, 'pricePerUnit', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div className={line.itemType === 'OTHER' ? 'col-span-1' : 'col-span-2'}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Total</label>
                        <div className="px-2 py-2 text-sm font-semibold text-gray-900 bg-gray-100 rounded-lg text-center">
                          {((parseFloat(line.quantity) || 0) * (parseFloat(line.pricePerUnit) || 0)).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                        </div>
                      </div>

                      <div className="col-span-1 flex items-end">
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(line.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Grand Total</p>
                  <p className="text-3xl font-bold text-blue-600">
                    Rs {getTotalAmount().toLocaleString('en-PK')}
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Save Purchase
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase History */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Purchase History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price/Unit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {purchases.map(purchase => (
                <tr key={purchase.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {format(new Date(purchase.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {purchase.itemType === 'OTHER' ? purchase.customItemName : purchase.itemType}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{purchase.batchNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{purchase.supplier}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">{purchase.quantity}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    Rs {purchase.pricePerUnit.toLocaleString('en-PK')}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                    Rs {purchase.totalCost.toLocaleString('en-PK')}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className={purchase.remainingQuantity > 0 ? 'text-green-600' : 'text-gray-400'}>
                      {purchase.remainingQuantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deletePurchase(purchase.id)}
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