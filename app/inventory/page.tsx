// app/inventory/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Package, AlertCircle } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { PurchaseItem, InventoryItem, ItemType } from '@/lib/types';
import { format } from 'date-fns';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    loadInventory();
  }, []);

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

  const getItemDisplayName = (item: InventoryItem) => {
    if (item.itemType === 'OTHER' && item.customItemName) {
      return item.customItemName;
    }
    return item.itemType;
  };

  const getTotalInventoryValue = () => {
    return inventory.reduce((sum, item) => 
      sum + (item.totalQuantity * item.averageCost), 0
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Inventory Value</p>
          <p className="text-2xl font-bold text-green-600">
            Rs {getTotalInventoryValue().toLocaleString('en-PK')}
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-500 mr-2 mt-0.5" />
          <div>
            <p className="text-blue-700 font-medium">FIFO Method Applied</p>
            <p className="text-blue-600 text-sm">First-In-First-Out: Oldest inventory is sold first automatically</p>
          </div>
        </div>
      </div>

      {inventory.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Inventory</h3>
          <p className="text-gray-600">Start by adding purchases to build your inventory</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {inventory.map((item, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Package className="w-6 h-6" />
                    <h3 className="text-xl font-bold">{getItemDisplayName(item)}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">Total Stock</p>
                    <p className="text-2xl font-bold">{item.totalQuantity} units</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span>Average Cost: Rs {item.averageCost.toLocaleString('en-PK')}</span>
                  <span>Total Value: Rs {(item.totalQuantity * item.averageCost).toLocaleString('en-PK')}</span>
                </div>
              </div>

              <div className="p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Batches (FIFO Order - Oldest First)</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Original Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price/Unit</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Batch Value</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {item.batches.map((batch) => (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {format(new Date(batch.date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{batch.batchNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{batch.supplier}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">{batch.quantity}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span className={`font-semibold ${
                              batch.remainingQuantity < batch.quantity * 0.2 
                                ? 'text-red-600' 
                                : 'text-green-600'
                            }`}>
                              {batch.remainingQuantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            Rs {batch.pricePerUnit.toLocaleString('en-PK')}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            Rs {(batch.remainingQuantity * batch.pricePerUnit).toLocaleString('en-PK')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}