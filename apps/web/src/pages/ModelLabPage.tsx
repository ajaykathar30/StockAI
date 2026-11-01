import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getModelRuns,
  trainModelJob,
  activateModelRun,
  getJobStatus
} from '../services/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  Cpu,
  Play,
  Trophy,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  BarChart2,
  AlertCircle
} from 'lucide-react';

const ALGORITHM_OPTIONS = [
  { value: 'lightgbm', label: 'LightGBM Regressor (Core ML)', type: 'ml' },
  { value: 'xgboost', label: 'XGBoost Regressor (Core ML)', type: 'ml' },
  { value: 'random_forest', label: 'Random Forest Regressor', type: 'ml' },
  { value: 'seasonal_naive', label: 'Seasonal Naive (7-Day Last Week)', type: 'baseline' },
  { value: 'trailing_7d_mean', label: 'Trailing 7-Day Rolling Mean', type: 'baseline' },
  { value: 'previous_day_naive', label: 'Previous-Day Naive (Lag-1)', type: 'baseline' }
];

export const ModelLabPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedAlgo, setSelectedAlgo] = useState<string>('lightgbm');
  const [selectedTarget, setSelectedTarget] = useState<string>('units_sold');
  const [selectedMode, setSelectedMode] = useState<string>('quick');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{ percent: number; message: string; status: string } | null>(null);

  // Poll background training job
  useQuery({
    queryKey: ['jobStatus', activeJobId],
    queryFn: async () => {
      if (!activeJobId) return null;
      const job = await getJobStatus(activeJobId);
      setJobProgress({
        percent: job.progressPercent,
        message: job.message,
        status: job.status
      });

      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        setActiveJobId(null);
        queryClient.invalidateQueries({ queryKey: ['modelRuns'] });
        queryClient.invalidateQueries({ queryKey: ['overviewStats'] });
      }
      return job;
    },
    enabled: !!activeJobId,
    refetchInterval: 1500
  });

  const { data: runs, isLoading } = useQuery({
    queryKey: ['modelRuns'],
    queryFn: getModelRuns
  });

  const trainMutation = useMutation({
    mutationFn: () => trainModelJob({
      algorithm: selectedAlgo,
      target: selectedTarget,
      mode: selectedMode
    }),
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
    }
  });

  const activateMutation = useMutation({
    mutationFn: activateModelRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modelRuns'] });
      queryClient.invalidateQueries({ queryKey: ['overviewStats'] });
    }
  });

  const activeRun = runs?.find((r: any) => r.isActive) || runs?.[0];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Model Lab & Leaderboard</h2>
        <p className="text-xs text-slate-500 mt-1">
          Train and benchmark gradient boosting models against rule-based baselines using strict chronological splits.
        </p>
      </div>

      {/* Background Job Progress Bar */}
      {jobProgress && (
        <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400 animate-spin" />
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                Model training in progress ({jobProgress.status})
              </span>
            </div>
            <span className="text-xs font-bold text-teal-400">{jobProgress.percent}%</span>
          </div>
          <p className="text-xs text-slate-300 mb-3">{jobProgress.message}</p>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-teal-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${jobProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Model Training Controls Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-teal-700" />
            <h3 className="font-bold text-base text-slate-900">Launch Model Experiment</h3>
          </div>
          <span className="text-xs text-slate-400">Time-safe feature engineering</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Algorithm */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Algorithm</label>
            <select
              value={selectedAlgo}
              onChange={(e) => setSelectedAlgo(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500"
            >
              {ALGORITHM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Forecast Target</label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500"
            >
              <option value="units_sold">Observed Sales (units_sold - default)</option>
              <option value="estimated_demand">Estimated Demand (estimated_demand - synthetic)</option>
            </select>
          </div>

          {/* Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Tuning Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMode('quick')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                  selectedMode === 'quick'
                    ? 'bg-teal-50 border-teal-600 text-teal-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                Quick Mode
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('full')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                  selectedMode === 'full'
                    ? 'bg-teal-50 border-teal-600 text-teal-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                Full Mode
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => trainMutation.mutate()}
          disabled={trainMutation.isPending || !!activeJobId}
          className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          {trainMutation.isPending || activeJobId ? 'Training in Progress...' : 'Start Training & Chronological Evaluation'}
        </button>
      </div>

      {/* Model Benchmark Leaderboard Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-900">Untouched Test Split Leaderboard</h3>
          </div>
          <span className="text-xs text-slate-500">Sorted by lowest Test WAPE</span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Algorithm</th>
              <th className="p-3.5">Target</th>
              <th className="p-3.5 text-right">Test WAPE</th>
              <th className="p-3.5 text-right">Test MAE</th>
              <th className="p-3.5 text-right">Test RMSE</th>
              <th className="p-3.5 text-right">sMAPE</th>
              <th className="p-3.5 text-center">Interval Coverage (90%)</th>
              <th className="p-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">Loading benchmark runs...</td>
              </tr>
            ) : !runs || runs.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  No model runs logged yet. Launch training above to populate real benchmarks.
                </td>
              </tr>
            ) : (
              runs.map((run: any) => {
                const wapePct = run.metrics?.test?.wape ? `${Math.round(run.metrics.test.wape * 1000) / 10}%` : 'N/A';
                const coverage = run.metrics?.test?.intervalCoverage ? `${run.metrics.test.intervalCoverage}%` : 'N/A';

                return (
                  <tr key={run.modelId} className="hover:bg-slate-50/80 transition-colors">
                    {/* Status */}
                    <td className="p-3.5">
                      {run.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                          Archived
                        </span>
                      )}
                    </td>

                    {/* Algorithm */}
                    <td className="p-3.5 font-bold text-slate-900">
                      {run.algorithm?.replace(/_/g, ' ')?.toUpperCase()}
                    </td>

                    {/* Target */}
                    <td className="p-3.5 font-mono text-slate-500">
                      {run.target}
                    </td>

                    {/* Test WAPE */}
                    <td className="p-3.5 text-right font-bold text-teal-700">
                      {wapePct}
                    </td>

                    {/* Test MAE */}
                    <td className="p-3.5 text-right font-medium text-slate-700">
                      {run.metrics?.test?.mae}
                    </td>

                    {/* Test RMSE */}
                    <td className="p-3.5 text-right font-medium text-slate-700">
                      {run.metrics?.test?.rmse}
                    </td>

                    {/* sMAPE */}
                    <td className="p-3.5 text-right text-slate-600">
                      {run.metrics?.test?.smape}%
                    </td>

                    {/* Interval Coverage */}
                    <td className="p-3.5 text-center text-slate-700">
                      {coverage}
                    </td>

                    {/* Action */}
                    <td className="p-3.5 text-center">
                      {!run.isActive && (
                        <button
                          onClick={() => activateMutation.mutate(run.modelId)}
                          disabled={activateMutation.isPending}
                          className="px-2.5 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-50 rounded border border-teal-200 transition"
                        >
                          Activate
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

      {/* Feature Importance & Split Timeline Visualizer */}
      {activeRun?.featureImportance && activeRun.featureImportance.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Feature Importance Bar Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-teal-700" />
              <h4 className="font-bold text-sm text-slate-900">
                Native Feature Importance ({activeRun.algorithm?.replace(/_/g, ' ')})
              </h4>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activeRun.featureImportance}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="#64748b" />
                  <YAxis type="category" dataKey="feature" tick={{ fontSize: 10 }} stroke="#64748b" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2 rounded text-xs">
                            <p className="font-semibold">{pt.feature}</p>
                            <p className="text-teal-300">Importance: {pt.importance}</p>
                            <p className="text-slate-400 text-[10px]">Type: {pt.type}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="importance" fill="#0f766e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chronological Validation Split Visualizer */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-700" />
              <h4 className="font-bold text-sm text-slate-900">Chronological Split Architecture</h4>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                <span className="font-bold text-teal-900">Training Period (70%):</span>
                <p className="text-teal-800 mt-0.5">
                  Start to {activeRun.trainSplitDates?.trainEnd || 'N/A'}. Fitted encoders and trees.
                </p>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="font-bold text-blue-900">Validation Period (15%):</span>
                <p className="text-blue-800 mt-0.5">
                  {activeRun.trainSplitDates?.trainEnd || 'N/A'} to {activeRun.trainSplitDates?.valEnd || 'N/A'}. Early stopping and residual calibration.
                </p>
              </div>

              <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900">Untouched Test Split (15%):</span>
                <p className="text-slate-700 mt-0.5">
                  {activeRun.trainSplitDates?.valEnd || 'N/A'} to {activeRun.trainSplitDates?.testEnd || 'N/A'}. Final reported leaderboard scores.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
