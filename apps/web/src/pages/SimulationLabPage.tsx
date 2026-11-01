import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLatestSimulation, runSimulationJob, getJobStatus } from '../services/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  FlaskConical,
  Play,
  Clock,
  Layers,
  TrendingDown,
  Percent,
  AlertTriangle,
  Info
} from 'lucide-react';

export const SimulationLabPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [leadTime, setLeadTime] = useState<number>(2);
  const [reviewPeriod, setReviewPeriod] = useState<number>(1);
  const [holdingCost, setHoldingCost] = useState<number>(0.05);
  const [shortagePenalty, setShortagePenalty] = useState<number>(15.0);
  const [trackPerishability, setTrackPerishability] = useState<boolean>(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Poll background simulation job
  useQuery({
    queryKey: ['jobStatus', activeJobId],
    queryFn: async () => {
      if (!activeJobId) return null;
      const job = await getJobStatus(activeJobId);
      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        setActiveJobId(null);
        queryClient.invalidateQueries({ queryKey: ['latestSimulation'] });
      }
      return job;
    },
    enabled: !!activeJobId,
    refetchInterval: 1500
  });

  const { data: simulation, isLoading } = useQuery({
    queryKey: ['latestSimulation'],
    queryFn: getLatestSimulation
  });

  const simMutation = useMutation({
    mutationFn: () => runSimulationJob({
      leadTimeDays: leadTime,
      reviewPeriodDays: reviewPeriod,
      holdingCostRate: holdingCost,
      shortagePenaltyRate: shortagePenalty,
      trackPerishability
    }),
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
    }
  });

  const results = simulation?.results || {};
  const policiesList = Object.values(results) as any[];

  // Format bar chart data comparing policies
  const chartData = policiesList.map((p: any) => ({
    name: p.policyName?.replace('Policy', '')?.replace('Replenishment', '') || p.policyType,
    fillRate: p.fillRate,
    totalCost: p.totalSimulatedCost,
    stockoutDays: p.stockoutDays,
    expiredUnits: p.expiredUnits
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Simulation Lab & Policy Backtesting</h2>
        <p className="text-xs text-slate-500 mt-1">
          Simulate a continuous operational inventory ledger across historical test periods to evaluate service levels, lost sales, and holding costs.
        </p>
      </div>

      {/* Assumptions Configuration Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-teal-700" />
            <h3 className="font-bold text-base text-slate-900">Discrete-Event Simulator Assumptions</h3>
          </div>
          <span className="text-xs text-slate-400">Identical ground-truth demand replay</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700">Lead Time L (Days)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={leadTime}
              onChange={(e) => setLeadTime(parseInt(e.target.value, 10))}
              className="w-full mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700">Review Period R (Days)</label>
            <input
              type="number"
              min={1}
              max={7}
              value={reviewPeriod}
              onChange={(e) => setReviewPeriod(parseInt(e.target.value, 10))}
              className="w-full mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700">Holding Cost (₹/unit/day)</label>
            <input
              type="number"
              step={0.01}
              value={holdingCost}
              onChange={(e) => setHoldingCost(parseFloat(e.target.value))}
              className="w-full mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700">Shortage Penalty (₹/unit)</label>
            <input
              type="number"
              step={1}
              value={shortagePenalty}
              onChange={(e) => setShortagePenalty(parseFloat(e.target.value))}
              className="w-full mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={trackPerishability}
                onChange={(e) => setTrackPerishability(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span>FIFO Perishables</span>
            </label>
          </div>
        </div>

        <button
          onClick={() => simMutation.mutate()}
          disabled={simMutation.isPending || !!activeJobId}
          className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          {simMutation.isPending || activeJobId ? 'Simulation Backtest Running...' : 'Run Comparative Policy Simulation'}
        </button>
      </div>

      {/* Comparative Simulation Results Grid */}
      {policiesList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {policiesList.map((p: any) => {
            const isML = p.policyType === 'ml_driven_replenishment';

            return (
              <div
                key={p.policyType}
                className={`p-5 rounded-xl border flex flex-col justify-between ${
                  isML
                    ? 'bg-gradient-to-b from-teal-50/60 to-white border-teal-300 shadow-sm'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900">{p.policyName}</span>
                    {isML && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-600 text-white">
                        Recommended
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mt-4 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Fill Rate (Service Level):</span>
                      <span className="font-bold text-teal-700">{p.fillRate}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Stockout Days:</span>
                      <span className={`font-semibold ${p.stockoutDays > 5 ? 'text-red-600' : 'text-slate-800'}`}>
                        {p.stockoutDays} days
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Unmet Demand:</span>
                      <span className="font-medium text-slate-800">{p.unmetDemandUnits} units</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Average Inventory:</span>
                      <span className="font-medium text-slate-800">{p.averageInventory} units</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Waste / Expired Units:</span>
                      <span className="font-medium text-slate-800">{p.expiredUnits} units</span>
                    </div>
                    <div className="flex justify-between py-1 pt-2 font-bold text-slate-900">
                      <span>Total Simulated Policy Cost:</span>
                      <span className="text-sm text-slate-900">₹{p.totalSimulatedCost?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comparative Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-sm text-slate-900 mb-4">Fill Rate Comparison (%)</h4>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" interval={0} />
                  <YAxis domain={[70, 100]} tick={{ fontSize: 10 }} stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="fillRate" fill="#0f766e" radius={[4, 4, 0, 0]} name="Fill Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-sm text-slate-900 mb-4">Total Simulated Cost (₹)</h4>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="totalCost" fill="#334155" radius={[4, 4, 0, 0]} name="Total Cost (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Academic Disclaimer Box */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {simulation?.limitationsDisclaimer || (
            "Academic inventory decision-support prototype. Simulated outcomes are synthetic replays. Observed-sales replay is an operational proxy and does not reconstruct unobserved latent demand during historical stock-outs."
          )}
        </p>
      </div>
    </div>
  );
};
