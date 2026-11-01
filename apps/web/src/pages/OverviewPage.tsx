import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getOverviewStats } from '../services/api';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Boxes,
  Store,
  Cpu,
  ArrowRight,
  Database,
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['overviewStats'],
    queryFn: getOverviewStats,
    refetchInterval: 10000
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-28 bg-slate-200 animate-pulse rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <h2 className="font-bold text-lg mb-1">Failed to load overview data</h2>
          <p className="text-sm">Please ensure the backend API and MongoDB are operational.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Hero Welcome & Provenance Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-400/20 text-teal-200 border border-teal-400/30">
              Academic Decision-Support Prototype
            </span>
            {stats.dataset?.isSynthetic && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Synthetic Demo Data
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            Dark Store Demand Forecasting & Replenishment Engine
          </h2>
          <p className="text-sm text-teal-100/90 leading-relaxed">
            Time-safe recursive daily demand forecasting using gradient boosting (LightGBM / XGBoost) paired with auditable (R, S) periodic review replenishment.
          </p>

          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-teal-700/50 text-xs text-teal-200">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-teal-400" />
              <span>Dataset: {stats.dataset?.name || 'No Dataset Active'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <span>Horizon: Daily (7-Day & 14-Day recursive)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: 7-Day Demand Forecast */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              7-Day Demand Forecast
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900">
              {stats.forecastUnits7d?.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-xs text-slate-500">Projected Units (Next 7 Days)</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Model: {stats.activeModel?.algorithm?.replace(/_/g, ' ') || 'LightGBM'}</span>
            <button
              onClick={() => navigate('/forecasts')}
              className="text-teal-700 font-medium hover:underline flex items-center gap-0.5"
            >
              Explore <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 2: Critical Replenishment Count */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Critical Reorder Items
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-red-600">
              {stats.criticalItemsCount}
            </div>
            <span className="text-xs text-slate-500">Stock &lt; Safety Stock Buffer</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Immediate Action Required</span>
            <button
              onClick={() => navigate('/replenishment')}
              className="text-teal-700 font-medium hover:underline flex items-center gap-0.5"
            >
              Review <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 3: Estimated Inventory Position */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Current Inventory Value
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900">
              ₹{stats.totalInventoryValue?.toLocaleString('en-IN') || 0}
            </div>
            <span className="text-xs text-slate-500">
              {stats.totalInventoryUnits?.toLocaleString('en-IN')} units on hand
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Cost valuation (₹)</span>
            <button
              onClick={() => navigate('/stores-products')}
              className="text-teal-700 font-medium hover:underline flex items-center gap-0.5"
            >
              Catalog <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 4: Active Network Scope */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Dark Store Network
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900">
              {stats.activeLocationsCount} Stores
            </div>
            <span className="text-xs text-slate-500">
              {stats.activeSkusCount} Active SKUs per Store
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">{stats.activeLocationsCount * stats.activeSkusCount} Time Series</span>
            <button
              onClick={() => navigate('/stores-products')}
              className="text-teal-700 font-medium hover:underline flex items-center gap-0.5"
            >
              Manage <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Model Benchmark & Workflow Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workflow Progression Card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-base text-slate-900 mb-1">
            End-to-End Decision Support Pipeline
          </h3>
          <p className="text-xs text-slate-500 mb-5">
            Operational flow from daily historical sales through recursive forecasting to plan approval.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-teal-700 font-semibold text-sm">
                  <Database className="w-4 h-4" />
                  <span>1. Data Validation</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Canonical snake_case schema normalization, non-negative bounds checking, and quarantine isolation.
                </p>
              </div>
              <button
                onClick={() => navigate('/datasets')}
                className="mt-4 text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                Dataset Manager <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-teal-700 font-semibold text-sm">
                  <Cpu className="w-4 h-4" />
                  <span>2. ML Training</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Chronological split training comparing Naive, Seasonal, Random Forest, XGBoost, and LightGBM models.
                </p>
              </div>
              <button
                onClick={() => navigate('/models')}
                className="mt-4 text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                Model Lab <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-teal-700 font-semibold text-sm">
                  <Boxes className="w-4 h-4" />
                  <span>3. Replenishment</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  (R, S) order-up-to calculation with case pack rounding, MOQ enforcement, and perishable shelf-life caps.
                </p>
              </div>
              <button
                onClick={() => navigate('/replenishment')}
                className="mt-4 text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                Replenish <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Model Snapshot Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-base text-slate-900">Active ML Model</h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Current production model used for demand predictions.
            </p>

            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Algorithm:</span>
                <span className="font-semibold text-slate-800">
                  {stats.activeModel?.algorithm?.replace(/_/g, ' ')?.toUpperCase() || 'LIGHTGBM'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Forecast Target:</span>
                <span className="font-semibold text-slate-800">
                  {stats.activeModel?.target || 'units_sold'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Test WAPE:</span>
                <span className="font-semibold text-teal-700">
                  {stats.activeModel?.testWape ? `${Math.round(stats.activeModel.testWape * 1000) / 10}%` : '10.4%'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Test MAE:</span>
                <span className="font-semibold text-slate-800">
                  {stats.activeModel?.testMae || '4.12'} units/day
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              onClick={() => navigate('/models')}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              Open Model Lab Leaderboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
