import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  generateRecommendations,
  getPurchasePlans,
  saveDraftPlan,
  approvePlan
} from '../services/api';
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Download,
  Save,
  HelpCircle,
  FileCheck,
  ShieldAlert,
  X,
  Layers,
  ArrowRight
} from 'lucide-react';

export const ReplenishmentPlannerPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [capacityLimit, setCapacityLimit] = useState<string>('');
  const [budgetLimit, setBudgetLimit] = useState<string>('');
  const [auditItem, setAuditItem] = useState<any | null>(null);
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);

  // Recommendations query
  const { data: recData, isLoading: recLoading, refetch: refetchRecs } = useQuery({
    queryKey: ['recommendations', selectedStore, selectedCategory, capacityLimit, budgetLimit],
    queryFn: () => generateRecommendations({
      storeId: selectedStore,
      category: selectedCategory,
      warehouseCapacityLimit: capacityLimit ? parseInt(capacityLimit, 10) : undefined,
      procurementBudgetLimit: budgetLimit ? parseFloat(budgetLimit) : undefined
    })
  });

  // Saved plans query
  const { data: plans } = useQuery({
    queryKey: ['purchasePlans'],
    queryFn: getPurchasePlans
  });

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: (items: any[]) => saveDraftPlan({
      name: `Replenishment Draft (${new Date().toLocaleDateString()})`,
      items,
      notes: 'Generated via periodic review replenishment engine.'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasePlans'] });
      alert('Draft replenishment plan saved successfully.');
    }
  });

  // Approve plan mutation
  const approveMutation = useMutation({
    mutationFn: (planId: string) => approvePlan(planId, { confirmed: true, approvedBy: 'Lead Inventory Analyst' }),
    onSuccess: (data) => {
      setConfirmApproveId(null);
      queryClient.invalidateQueries({ queryKey: ['purchasePlans'] });
      queryClient.invalidateQueries({ queryKey: ['storeProducts'] });
      queryClient.invalidateQueries({ queryKey: ['overviewStats'] });
      alert(`Plan approved: ${data.notice}`);
    }
  });

  const items = recData?.recommendations || [];
  const summary = recData?.summary;

  const priorityColors: Record<string, string> = {
    'Critical': 'bg-red-100 text-red-800 border-red-200',
    'Reorder soon': 'bg-amber-100 text-amber-800 border-amber-200',
    'Healthy': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Excess inventory': 'bg-blue-100 text-blue-800 border-blue-200'
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Replenishment Planner</h2>
          <p className="text-xs text-slate-500 mt-1">
            Auditable (R, S) order-up-to policy balancing holding cost, stockout penalties, MOQ, and shelf-life constraints.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/reports/export/replenishment-csv"
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export Plan CSV
          </a>

          <button
            onClick={() => items.length && saveDraftMutation.mutate(items)}
            disabled={!items.length || saveDraftMutation.isPending}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            Save as Draft Plan
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] text-slate-500 font-medium uppercase">Suggested Units</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {summary.totalUnits?.toLocaleString('en-IN')} units
            </div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] text-slate-500 font-medium uppercase">Total Procurement Cost</span>
            <div className="text-2xl font-bold text-teal-800 mt-1">
              ₹{summary.totalCost?.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="p-4 bg-red-50 rounded-xl border border-red-200">
            <span className="text-[11px] text-red-700 font-medium uppercase">Critical Shortages</span>
            <div className="text-2xl font-bold text-red-700 mt-1">
              {summary.criticalCount} SKUs
            </div>
          </div>
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <span className="text-[11px] text-amber-700 font-medium uppercase">Reorder Soon</span>
            <div className="text-2xl font-bold text-amber-800 mt-1">
              {summary.reorderSoonCount} SKUs
            </div>
          </div>
        </div>
      )}

      {/* Constraint Warnings */}
      {(summary?.capacityWarning || summary?.budgetWarning) && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
          {summary.capacityWarning && <p>• <strong>Capacity Notice:</strong> {summary.capacityWarning}</p>}
          {summary.budgetWarning && <p>• <strong>Budget Notice:</strong> {summary.budgetWarning}</p>}
        </div>
      )}

      {/* Recommendations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900">Ranked Replenishment Suggestions</h3>
            <span className="text-xs text-slate-500">({items.length} items evaluated)</span>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Store:</span>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="py-1 px-2 border rounded text-xs bg-slate-50"
              >
                <option value="ALL">All Stores</option>
                <option value="DS_BLR_KORAMANGALA">DS_BLR_KORAMANGALA</option>
                <option value="DS_MUM_ANDHERI">DS_MUM_ANDHERI</option>
                <option value="DS_DEL_INDIRAPURAM">DS_DEL_INDIRAPURAM</option>
                <option value="DS_PUN_KOTHRUD">DS_PUN_KOTHRUD</option>
                <option value="DS_KOL_SALTLAKE">DS_KOL_SALTLAKE</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="py-1 px-2 border rounded text-xs bg-slate-50"
              >
                <option value="ALL">All Categories</option>
                <option value="Dairy">Dairy</option>
                <option value="Bakery">Bakery</option>
                <option value="Produce">Produce</option>
                <option value="Beverages">Beverages</option>
                <option value="Snacks">Snacks</option>
                <option value="Household">Household</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Store & SKU</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5 text-right">L+R Forecast</th>
                <th className="p-3.5 text-right">Safety Stock</th>
                <th className="p-3.5 text-right">Inv Position</th>
                <th className="p-3.5 text-right">Raw Need</th>
                <th className="p-3.5 text-right font-bold text-teal-800">Final Order</th>
                <th className="p-3.5 text-right">Estimated Cost</th>
                <th className="p-3.5 text-center">Formula Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recLoading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">Computing replenishment requirements...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">No replenishment needed for current inventory levels.</td>
                </tr>
              ) : (
                items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Priority Badge */}
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityColors[item.priority] || 'bg-slate-100'}`}>
                        {item.priority}
                      </span>
                    </td>

                    {/* Store & SKU */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{item.product_id}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{item.store_id}</div>
                    </td>

                    {/* Category */}
                    <td className="p-3.5 text-slate-600">{item.category}</td>

                    {/* Forecast */}
                    <td className="p-3.5 text-right text-slate-700">
                      {item.protection_period_forecast}
                    </td>

                    {/* Safety Stock */}
                    <td className="p-3.5 text-right font-medium text-slate-700">
                      {item.safety_stock}
                    </td>

                    {/* Inventory Position */}
                    <td className="p-3.5 text-right font-medium text-slate-700">
                      {item.inventory_position}
                    </td>

                    {/* Raw Suggested */}
                    <td className="p-3.5 text-right text-slate-500">
                      {item.raw_suggested_order}
                    </td>

                    {/* Final Order */}
                    <td className="p-3.5 text-right font-bold text-teal-700">
                      {item.rounded_order_qty}
                    </td>

                    {/* Total Cost */}
                    <td className="p-3.5 text-right font-semibold text-slate-900">
                      ₹{item.total_order_cost?.toLocaleString('en-IN')}
                    </td>

                    {/* Audit Button */}
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => setAuditItem(item)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 text-[11px] font-medium transition"
                      >
                        Explain
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saved / Approved Purchase Plans Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Saved Replenishment & Purchase Plans</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Draft and approved operational replenishment records (persisted across sessions).
            </p>
          </div>
        </div>

        {plans && plans.length > 0 ? (
          <div className="space-y-3">
            {plans.map((p: any) => (
              <div
                key={p.planId}
                className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{p.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-4">
                    <span>Total: <strong>{p.totalUnits} units</strong></span>
                    <span>Cost: <strong>₹{p.totalCost?.toLocaleString('en-IN')}</strong></span>
                    <span>Created: {new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/api/reports/export/replenishment-csv?planId=${p.planId}`}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-xs font-semibold text-slate-700"
                  >
                    CSV Export
                  </a>

                  {p.status === 'DRAFT' && (
                    <button
                      onClick={() => setConfirmApproveId(p.planId)}
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-semibold"
                    >
                      Approve Plan
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-4">No draft or approved plans yet.</p>
        )}
      </div>

      {/* Formula Audit Modal */}
      {auditItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-base text-slate-900">
                Replenishment Logic Breakdown
              </h4>
              <button onClick={() => setAuditItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p><strong>SKU:</strong> {auditItem.product_id} @ {auditItem.store_id}</p>
              <p className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-800 font-medium">
                {auditItem.explanation}
              </p>

              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Protection Period (L+R):</span>
                  <span className="font-mono">{auditItem.protection_period_days} Days</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Protection-Period Forecast:</span>
                  <span className="font-mono">{auditItem.protection_period_forecast} Units</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Calibrated Safety Stock:</span>
                  <span className="font-mono">{auditItem.safety_stock} Units</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Target Stock Level (S):</span>
                  <span className="font-mono">{auditItem.target_stock} Units</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Inventory Position (OnHand + OnOrder - Committed):</span>
                  <span className="font-mono">{auditItem.inventory_position} Units</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Raw Suggested Order:</span>
                  <span className="font-mono">{auditItem.raw_suggested_order} Units</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-teal-800">
                  <span>Pack/MOQ Rounded Order:</span>
                  <span className="font-mono">{auditItem.rounded_order_qty} Units</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setAuditItem(null)}
              className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
            >
              Close Audit
            </button>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal for Approval */}
      {confirmApproveId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center gap-2 text-teal-700">
              <ShieldAlert className="w-5 h-5 text-teal-600" />
              <h4 className="font-bold text-base text-slate-900">Confirm Plan Approval</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to approve this replenishment plan?
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <strong>Notice:</strong> Plan approval creates active planning records in MongoDB and commits replenishment allocations.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmApproveId(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => approveMutation.mutate(confirmApproveId)}
                disabled={approveMutation.isPending}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold"
              >
                {approveMutation.isPending ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
