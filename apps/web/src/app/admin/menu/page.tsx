'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function MenuAdmin() {
  const [items, setItems] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);

  function load() {
    api<{ items: any[] }>('/api/v1/menu/items' + (branchId ? `?branchId=${branchId}` : ''))
      .then((r) => setItems(r.items));
  }
  useEffect(() => {
    api<any>('/api/v1/menu/branch').then((r) => setBranchId(r.branch?.id));
  }, []);
  useEffect(() => { if (branchId) load(); }, [branchId]);

  async function setStock(itemId: string, available: number) {
    if (!branchId) return;
    await api(`/api/v1/admin/inventory/${itemId}`, {
      method: 'PATCH', body: JSON.stringify({ branchId, available }),
    });
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-900">Menu &amp; inventory</h1>
      <p className="text-sm text-slate-500">Toggle stock on/off; ML prep estimates can override the static prepMinutes later.</p>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-2">Item</th>
            <th>Category</th>
            <th>Price</th>
            <th>Prep</th>
            <th className="text-right">Stock</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-slate-100">
              <td className="py-2">
                <span className={`mr-1 inline-block h-2 w-2 rounded-full ${i.isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {i.name}
              </td>
              <td className="text-slate-500">{i.categoryName}</td>
              <td>₹{i.basePrice}</td>
              <td>{i.prepMinutes}m</td>
              <td className="space-x-2 text-right">
                {i.available ? (
                  <button className="btn-secondary !py-1 text-xs" onClick={() => setStock(i.id, 0)}>
                    Mark sold out
                  </button>
                ) : (
                  <button className="btn-primary !py-1 text-xs" onClick={() => setStock(i.id, 999)}>
                    Restock
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
