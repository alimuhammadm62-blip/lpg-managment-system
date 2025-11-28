'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { PurchaseItem, ItemType } from '@/lib/types';
import { format } from 'date-fns';

const ITEM_TYPES: (ItemType | 'OTHER')[] = ['SN', 'BN', 'C', 'BNS', 'SNS', 'CS', 'ABN', 'ASN', 'OTHER'];

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

  const getInitialLineItems = (): PurchaseLineItem[] => [
    { id: '1', itemType: 'SN', customItemName: '', quantity: '', pricePerUnit: '' },
    { id: '2', itemType: 'BN', customItemName: '', quantity: '', pricePerUnit: '' },
    { id: '3', itemType: 'C', customItemName: '', quantity: '', pricePerUnit: '' },
  ];

  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>(getInitialLineItems());

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
    const existingBatches = storage.get<PurchaseItem[]>(STORAGE_KEYS.PURCHASES) || [];
    const nextNumber = existingBatches.length + 1;
    return nextNumber.toString().padStart(3, '0');
  };

  const roundToNearest10 = (value: number) => {
    return Math.ceil(value)
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { 
      id: Date.now().toString(), 
      itemType: 'OTHER', 
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
  setLineItems(prev =>
    prev.map(item => {
      let updatedItem = { ...item };

      if (item.id === id) {
        if (field === 'itemType') {
          updatedItem[field] = value as ItemType | 'OTHER';
        } else {
          updatedItem[field] = value;
        }
      }

        // Auto-calculate BN and C prices from SN with rounding to nearest 10
        const snLine = prev.find(li => li.itemType === 'SN');
        const snRate = snLine ? parseFloat(snLine.pricePerUnit) || 0 : 0;

        if (snRate > 0) {
          if (item.itemType === 'BN') {
            const calculatedPrice = (snRate / 11.8) * 15;
            updatedItem.pricePerUnit = roundToNearest10(calculatedPrice).toString();
          }
          if (item.itemType === 'C') {
            const calculatedPrice = (snRate / 11.8) * 45.4;
            updatedItem.pricePerUnit = roundToNearest10(calculatedPrice).toString();
          }
        }

        return updatedItem;
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newPurchases: PurchaseItem[] = [];
    const updatedCustomItems = [...customItems];
    const batchNumber = generateBatchNumber();

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
        batchNumber: batchNumber,
        remainingQuantity: parseFloat(line.quantity),
      };

      newPurchases.push(newPurchase);

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
    setFormData({ date: format(new Date(), 'yyyy-MM-dd'), supplier: '' });
    setLineItems(getInitialLineItems());
    setShowModal(false);
  };

  const handleCancel = () => {
    setFormData({ date: format(new Date(), 'yyyy-MM-dd'), supplier: '' });
    setLineItems(getInitialLineItems());
    setShowModal(false);
  };

  const deletePurchase = (id: string) => {
    if (confirm('Are you sure you want to delete this purchase?')) {
      const updatedPurchases = purchases.filter(p => p.id !== id);
      storage.set(STORAGE_KEYS.PURCHASES, updatedPurchases);
      setPurchases(updatedPurchases);
    }
  };

  const getTotalAmount = () => lineItems.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.pricePerUnit) || 0;
    return sum + qty * price;
  }, 0);

  const totalPurchaseValue = purchases.reduce((sum, p) => sum + p.totalCost, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">Purchase Management</h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4">
            <div className="flex flex-col items-center w-full sm:min-w-[250px] sm:w-auto">
              <p className="text-sm sm:text-base text-gray-900 font-semibold mb-1">Total Purchases</p>
              <div className="bg-white shadow-lg rounded-xl px-4 sm:px-6 py-3 sm:py-4 border border-gray-200 h-[60px] flex items-center justify-center w-full">
                <p className="text-xl sm:text-2xl font-bold text-blue-600">Rs {totalPurchaseValue.toLocaleString('en-PK')}</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 h-[60px] w-full sm:min-w-[180px] sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              <span>Add Purchase</span>
            </button>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-4 sm:py-5 flex justify-between items-center">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Add New Purchase</h2>
                  <p className="text-blue-100 text-xs sm:text-sm mt-1">Enter purchase details below</p>
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
                  {/* Date & Supplier */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Purchase Date *</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Supplier Name *</label>
                      <input
                        type="text"
                        value={formData.supplier}
                        onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                        placeholder="Enter supplier name"
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Items Section */}
                  <div className="border-t-2 border-gray-200 pt-4 sm:pt-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900">Purchase Items</h3>
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
                            {/* Item Type */}
                            <div className="col-span-12 sm:col-span-3">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Item Type</label>
                              <select
                                value={line.itemType}
                                onChange={e => updateLineItem(line.id, 'itemType', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium"
                                required
                              >
                                {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>

                            {/* Custom Item Name (if OTHER) */}
                            {line.itemType === 'OTHER' && (
                              <div className="col-span-12 sm:col-span-3">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Item Name *</label>
                                <input
                                  type="text"
                                  value={line.customItemName}
                                  onChange={e => updateLineItem(line.id, 'customItemName', e.target.value)}
                                  placeholder="Enter item name"
                                  className="w-full px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  required
                                  list="custom-items"
                                />
                                <datalist id="custom-items">
                                  {customItems.map(item => <option key={item} value={item} />)}
                                </datalist>
                              </div>
                            )}

                            {/* Price per Unit */}
                            <div className={`col-span-6 ${line.itemType === 'OTHER' ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
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

                            {/* Quantity */}
                            <div className={`col-span-6 ${line.itemType === 'OTHER' ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
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

                            {/* Total */}
                            <div className={`col-span-10 ${line.itemType === 'OTHER' ? 'sm:col-span-1' : 'sm:col-span-2'}`}>
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
                        Save Purchase
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Purchase History Table */}
        <div className="bg-white shadow-xl rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Purchase History</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">View all your purchase records</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Item</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Batch #</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Supplier</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Qty</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Price/Unit</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Total</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Remaining</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 sm:px-6 py-8 sm:py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Plus className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4 opacity-20" />
                        <p className="text-base sm:text-lg font-semibold">No purchases recorded yet</p>
                        <p className="text-xs sm:text-sm mt-1">Click "Add Purchase" to get started</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  purchases.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {format(new Date(p.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className="text-xs sm:text-sm font-semibold text-gray-900">
                          {p.itemType === 'OTHER' ? p.customItemName : p.itemType}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 font-mono">
                        {p.batchNumber}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                        {p.supplier}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right font-medium text-gray-900">
                        {p.quantity}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right text-gray-900">
                        Rs {p.pricePerUnit.toLocaleString('en-PK')}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right font-bold text-gray-900">
                        Rs {p.totalCost.toLocaleString('en-PK')}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right">
                        <span className={`font-bold ${p.remainingQuantity > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {p.remainingQuantity}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => deletePurchase(p.id)}
                          className="inline-flex items-center justify-center p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          title="Delete purchase"
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