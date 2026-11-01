import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLatestForecasts,
  runForecastJob,
  getStoreProducts,
  getJobStatus
} from '../services/api';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  LineChart as LineChartIcon,
  Play,
  Download,
  AlertTriangle,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';

export const ForecastExplorerPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [selectedStore, setSelectedStore] = useState<string>('DS_BLR_KORAMANGALA');
  const [selectedProduct, setSelectedProduct] = useState<string>('SKU_DAIRY_MILK_1L');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Poll background forecasting job
  useQuery({
    queryKey: ['jobStatus', activeJobId],
    queryFn: async () => {
      if (!activeJobId) return null;
      const job = await getJobStatus(activeJobId);
      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        setActiveJobId(null);
        queryClient.invalidateQueries({ queryKey: ['latestForecasts'] });
      }
      return job;
    },
    enabled: !!activeJobId,
    refetchInterval: 1500
  });

  const { data: catalogData } = useQuery({
    queryKey: ['storeProductsOptions'],
    queryFn: () => getStoreProducts({ limit: 100 })
  });

  const { data: forecastData, isLoading } = useQuery({
    queryKey: ['latestForecasts', horizonDays, selectedStore, selectedProduct],
    queryFn: () => getLatestForecasts({
      horizonDays,
      storeId: selectedStore,
      productId: selectedProduct
    })
  });

  const forecastMutation = useMutation({
    mutationFn: () => runForecastJob({ horizonDays }),
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
    }
  });

  const stores = catalogData?.filterOptions?.stores || ['DS_BLR_KORAMANGALA', 'DS_MUM_ANDHERI', 'DS_DEL_INDIRAPURAM'];
  const products = Array.from(new Set((catalogData?.items || []).map((i: any) => i.product_id))) as string[];

  // Format chart data
  const rawPoints = forecastData?.forecasts || [];
  const chartData = rawPoints.map((pt: any) => ({
    date: pt.date,
    forecast: pt.predicted_mean,
    lower: pt.lower_bound,
    upper: pt.upper_bound,
    intervalRange: [pt.lower_bound, pt.upper_bound],
    isColdStart: pt.is_cold_start
  }));

  const hasColdStart = rawPoints.some((pt: any) => pt.is_cold_start);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Demand Forecast Explorer</h2>
          <p className="text-xs text-slate-500 mt-1">
            Recursive multi-step time series demand predictions with calibrated uncertainty intervals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/reports/export/forecast-csv"
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export Forecast CSV
          </a>

          <button
            onClick={() => forecastMutation.mutate()}
            disabled={forecastMutation.isPending || !!activeJobId}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {forecastMutation.isPending || activeJobId ? 'Forecasting...' : 'Run New Forecast'}
          </button>
        </div>
      </div>

      {/* Control Bar: Horizon, Store, and Product Selection */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Horizon Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Horizon:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              {[1, 7, 14].map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizonDays(h)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    horizonDays === h
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {h} Day{h > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Store Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Store:</span>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500"
            >
              {stores.map((s: string) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Product Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">SKU:</span>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500 max-w-[220px]"
            >
              {products.length > 0 ? (
                products.map((p: string) => (
                  <option key={p} value={p}>{p}</option>
                ))
              ) : (
                <option value="SKU_DAIRY_MILK_1L">SKU_DAIRY_MILK_1L</option>
              )}
            </select>
          </div>
        </div>

        {/* Cold Start Indicator */}
        {hasColdStart && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Insufficient history: Cold-start fallback applied.</span>
          </div>
        )}
      </div>

      {/* Main Forecast Chart Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              Demand Forecast Trajectory: {selectedProduct} @ {selectedStore}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Point forecast (mean demand) accompanied by calibrated 10th-90th percentile uncertainty interval.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-teal-600" />
              <span className="text-slate-700">Forecasted Demand</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-teal-100 border border-teal-300" />
              <span className="text-slate-600">Prediction Interval (80% Band)</span>
            </div>
          </div>
        </div>

        {/* Recharts Container */}
        <div className="h-80 w-full pt-4">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Loading forecast trajectory...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
              <LineChartIcon className="w-8 h-8 text-slate-300" />
              <p>No forecasts generated yet for this selection.</p>
              <button
                onClick={() => forecastMutation.mutate()}
                className="mt-2 text-teal-700 font-semibold hover:underline"
              >
                Click here to run a {horizonDays}-day forecast
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" label={{ value: 'Units / Day', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-lg text-xs space-y-1">
                          <p className="font-bold border-b border-slate-700 pb-1">{label}</p>
                          <p className="text-teal-300 font-semibold">Forecast: {data.forecast} units</p>
                          <p className="text-slate-300">Lower (10%): {data.lower} units</p>
                          <p className="text-slate-300">Upper (90%): {data.upper} units</p>
                          {data.isColdStart && (
                            <p className="text-amber-400 text-[10px]">Cold-start series fallback</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Upper band and area */}
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="#ccfbf1"
                  fillOpacity={0.6}
                  name="Upper Band"
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="none"
                  fill="#ffffff"
                  fillOpacity={1.0}
                  name="Lower Band"
                />
                {/* Point Forecast Line */}
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0f766e' }}
                  name="Forecast"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Detailed Forecast Points Table */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900">Daily Demand Schedule</h4>
            <span className="text-xs text-slate-500">{chartData.length} Daily Projections</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Forecast Date</th>
                <th className="p-3">Store</th>
                <th className="p-3">Product SKU</th>
                <th className="p-3 text-right">Point Forecast</th>
                <th className="p-3 text-right">Lower Bound (10%)</th>
                <th className="p-3 text-right">Upper Bound (90%)</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {chartData.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/80">
                  <td className="p-3 font-semibold text-slate-900">{row.date}</td>
                  <td className="p-3 font-mono text-slate-500">{selectedStore}</td>
                  <td className="p-3 font-mono text-slate-700">{selectedProduct}</td>
                  <td className="p-3 text-right font-bold text-teal-700">{row.forecast} units</td>
                  <td className="p-3 text-right text-slate-600">{row.lower} units</td>
                  <td className="p-3 text-right text-slate-600">{row.upper} units</td>
                  <td className="p-3 text-center">
                    {row.isColdStart ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                        Cold-Start
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        Calibrated ML
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
