import React from 'react';

// --- 1. The New Card Component ---
const InventoryCard = ({ product }) => {
  return (
    <div className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
      
      {/* HEADER: High-level info */}
      <div className="bg-gray-50 px-6 py-5 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        {/* Left: Product Identity */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-lg shadow-sm">
             {/* Cube Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{product.name}</h3>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-200 text-gray-600">Avg Cost: Rs {product.avgCost}</span>
            </div>
          </div>
        </div>

        {/* Right: Key Metrics */}
        <div className="flex gap-8 text-right">
          <div>
            <span className="block text-xs text-gray-500 uppercase font-bold tracking-wider">Total Stock</span>
            <span className="text-2xl font-bold text-gray-900">{product.totalStock} <span className="text-sm font-normal text-gray-400">units</span></span>
          </div>
          <div>
            <span className="block text-xs text-gray-500 uppercase font-bold tracking-wider">Total Value</span>
            <span className="text-2xl font-bold text-emerald-600">Rs {product.totalValue}</span>
          </div>
        </div>
      </div>

      {/* BODY: The Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-white border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs uppercase text-gray-400 font-bold tracking-wider">Batch Details</th>
              <th className="px-6 py-4 text-xs uppercase text-gray-400 font-bold tracking-wider">Supplier</th>
              <th className="px-6 py-4 text-xs uppercase text-gray-400 font-bold tracking-wider text-center">Stock Level</th>
              <th className="px-6 py-4 text-xs uppercase text-gray-400 font-bold tracking-wider text-right">Unit Cost</th>
              <th className="px-6 py-4 text-xs uppercase text-gray-400 font-bold tracking-wider text-right">Batch Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {product.batches.map((batch, index) => (
              <tr key={index} className="group hover:bg-blue-50/50 transition-colors">
                {/* Batch + Date Combined */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded text-xs">#{batch.batchId}</span>
                    <span className="font-medium text-gray-900">{batch.date}</span>
                  </div>
                </td>
                
                <td className="px-6 py-4 font-medium text-gray-700">{batch.supplier}</td>
                
                {/* Visual Stock Bar */}
                <td className="px-6 py-4">
                   <div className="flex flex-col items-center justify-center gap-1">
                       <span className={`text-xs font-bold ${batch.remaining < 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                           {batch.remaining} / {batch.originalQty} Left
                       </span>
                       {/* Simple Progress Bar */}
                       <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                           <div 
                             className={`h-full rounded-full ${batch.remaining < 5 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                             style={{ width: `${(batch.remaining / batch.originalQty) * 100}%` }}
                           ></div>
                       </div>
                   </div>
                </td>
                
                <td className="px-6 py-4 text-right">Rs {batch.pricePerUnit}</td>
                <td className="px-6 py-4 text-right font-bold text-gray-900">Rs {batch.batchValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FOOTER: Context */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-between items-center">
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          FIFO Active: Batch #{product.batches[0].batchId} is prioritized for sale.
        </p>
      </div>
    </div>
  );
};

// --- 2. The Page Container with Data ---
export default function NewInventoryPage() {
  
  // MOCKED DATA from your Screenshot
  const inventoryData = [
    {
      id: 1,
      name: "SN",
      avgCost: "2,090",
      totalStock: 22,
      totalValue: "46,000",
      batches: [
        { batchId: "004", date: "Nov 27, 2025", supplier: "ALFA", originalQty: 12, remaining: 12, pricePerUnit: "3,000", batchValue: "36,000" },
        { batchId: "005", date: "Nov 28, 2025", supplier: "ALFA", originalQty: 10, remaining: 10, pricePerUnit: "1,000", batchValue: "10,000" }
      ]
    },
    {
      id: 2,
      name: "BN",
      avgCost: "3,814",
      totalStock: 2,
      totalValue: "7,628",
      batches: [
        { batchId: "009", date: "Nov 29, 2025", supplier: "BETA", originalQty: 5, remaining: 2, pricePerUnit: "3,814", batchValue: "7,628" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Page Header */}
        <div className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-gray-500 mt-1">Real-time stock levels and valuation (FIFO).</p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm text-gray-500">Total Asset Value</div>
            <div className="text-3xl font-bold text-emerald-600">Rs 192,144</div>
          </div>
        </div>

        {/* Render Cards */}
        {inventoryData.map((product) => (
          <InventoryCard key={product.id} product={product} />
        ))}

      </div>
    </div>
  );
}