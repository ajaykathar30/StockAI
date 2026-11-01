import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoreProducts, updateStoreProduct } from '../services/api';
import {
  Store,
  Search,
  Filter,
  Edit2,
  Check,
  X,
  Package,
  Clock,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const StoresProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const { data, isLoading } = useQuery({
    queryKey: ['storeProducts', selectedStore, selectedCategory, search],
    queryFn: () => getStoreProducts({
      storeId: selectedStore,
      category: selectedCategory,
      search,
      limit: 100
    })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateStoreProduct(id, data),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['storeProducts'] });
      queryClient.invalidateQueries({ queryKey: ['overviewStats'] });
    }
  });

  const handleEdit = (item: any) => {
    setEditingId(item._id);
    setEditForm({
      usable_on_hand: item.usable_on_hand,
      confirmed_on_order: item.confirmed_on_order,
      lead_time_days: item.lead_time_days,
      review_period_days: item.review_period_days,
      target_service_level: item.target_service_level,
      case_pack_size: item.case_pack_size,
      min_order_qty: item.min_order_qty,
      unit_cost: item.unit_cost,
      selling_price: item.selling_price,
      shelf_life_days: item.shelf_life_days || ''
    });
  };

  const handleSave = (id: string) => {
    const payload = {
      ...editForm,
      usable_on_hand: parseInt(editForm.usable_on_hand, 10),
      confirmed_on_order: parseInt(editForm.confirmed_on_order, 10),
      lead_time_days: parseInt(editForm.lead_time_days, 10),
      review_period_days: parseInt(editForm.review_period_days, 10),
      target_service_level: parseFloat(editForm.target_service_level),
      case_pack_size: parseInt(editForm.case_pack_size, 10),
      min_order_qty: parseInt(editForm.min_order_qty, 10),
      unit_cost: parseFloat(editForm.unit_cost),
      selling_price: parseFloat(editForm.selling_price),
      shelf_life_days: editForm.shelf_life_days ? parseInt(editForm.shelf_life_days, 10) : undefined
    };
    updateMutation.mutate({ id, data: payload });
  };

  const stores = data?.filterOptions?.stores || [];
  const categories = data?.filterOptions?.categories || [];
  const items = data?.items || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Stores & Products Catalog</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure dark store inventory parameters, supplier lead times, target service levels, and case-pack constraints.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Synthetic Inventory Parameters</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU or Dark Store..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Store Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Store:</span>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">All Stores ({stores.length})</option>
            {stores.map((s: string) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((c: string) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Store & SKU</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5 text-right">On Hand</th>
                <th className="p-3.5 text-right">On Order</th>
                <th className="p-3.5 text-center">Lead Time (L)</th>
                <th className="p-3.5 text-center">Review (R)</th>
                <th className="p-3.5 text-center">Service Level</th>
                <th className="p-3.5 text-center">Case Pack / MOQ</th>
                <th className="p-3.5 text-right">Cost / Price (₹)</th>
                <th className="p-3.5 text-center">Shelf Life</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">Loading catalog items...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">No store-product records found.</td>
                </tr>
              ) : (
                items.map((item: any) => {
                  const isEditing = editingId === item._id;

                  return (
                    <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Store & SKU */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{item.product_id}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{item.store_id}</div>
                      </td>

                      {/* Category */}
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                          {item.category}
                        </span>
                      </td>

                      {/* Usable On Hand */}
                      <td className="p-3.5 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.usable_on_hand}
                            onChange={(e) => setEditForm({ ...editForm, usable_on_hand: e.target.value })}
                            className="w-16 px-1.5 py-1 border rounded text-right text-xs"
                          />
                        ) : (
                          <span className={`font-semibold ${item.usable_on_hand < 20 ? 'text-red-600' : 'text-slate-900'}`}>
                            {item.usable_on_hand}
                          </span>
                        )}
                      </td>

                      {/* Confirmed On Order */}
                      <td className="p-3.5 text-right font-medium text-slate-700">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.confirmed_on_order}
                            onChange={(e) => setEditForm({ ...editForm, confirmed_on_order: e.target.value })}
                            className="w-16 px-1.5 py-1 border rounded text-right text-xs"
                          />
                        ) : (
                          item.confirmed_on_order
                        )}
                      </td>

                      {/* Lead Time (L) */}
                      <td className="p-3.5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.lead_time_days}
                            onChange={(e) => setEditForm({ ...editForm, lead_time_days: e.target.value })}
                            className="w-12 px-1 py-1 border rounded text-center text-xs"
                          />
                        ) : (
                          <span>{item.lead_time_days}d</span>
                        )}
                      </td>

                      {/* Review Period (R) */}
                      <td className="p-3.5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.review_period_days}
                            onChange={(e) => setEditForm({ ...editForm, review_period_days: e.target.value })}
                            className="w-12 px-1 py-1 border rounded text-center text-xs"
                          />
                        ) : (
                          <span>{item.review_period_days}d</span>
                        )}
                      </td>

                      {/* Service Level */}
                      <td className="p-3.5 text-center font-medium">
                        {isEditing ? (
                          <select
                            value={editForm.target_service_level}
                            onChange={(e) => setEditForm({ ...editForm, target_service_level: e.target.value })}
                            className="border rounded px-1 py-1 text-xs"
                          >
                            <option value="0.90">90%</option>
                            <option value="0.95">95%</option>
                            <option value="0.98">98%</option>
                          </select>
                        ) : (
                          <span>{Math.round(item.target_service_level * 100)}%</span>
                        )}
                      </td>

                      {/* Pack / MOQ */}
                      <td className="p-3.5 text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              title="Case Pack"
                              value={editForm.case_pack_size}
                              onChange={(e) => setEditForm({ ...editForm, case_pack_size: e.target.value })}
                              className="w-10 px-1 py-1 border rounded text-center text-xs"
                            />
                            <span>/</span>
                            <input
                              type="number"
                              title="MOQ"
                              value={editForm.min_order_qty}
                              onChange={(e) => setEditForm({ ...editForm, min_order_qty: e.target.value })}
                              className="w-12 px-1 py-1 border rounded text-center text-xs"
                            />
                          </div>
                        ) : (
                          <span>{item.case_pack_size}p / {item.min_order_qty} min</span>
                        )}
                      </td>

                      {/* Cost / Selling Price */}
                      <td className="p-3.5 text-right font-medium">
                        ₹{item.unit_cost} / ₹{item.selling_price}
                      </td>

                      {/* Shelf Life */}
                      <td className="p-3.5 text-center">
                        {item.shelf_life_days ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                            {item.shelf_life_days}d expiry
                          </span>
                        ) : (
                          <span className="text-slate-400">Non-perishable</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              onClick={() => handleSave(item._id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Save Changes"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded"
                            title="Edit Parameters"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
