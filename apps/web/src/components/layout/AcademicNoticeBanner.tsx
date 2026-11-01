import React from 'react';
import { Info } from 'lucide-react';

export const AcademicNoticeBanner: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-950 text-white px-4 py-2 text-xs flex items-center justify-between border-b border-teal-800/40">
      <div className="flex items-center gap-2 max-w-5xl">
        <Info className="w-4 h-4 text-teal-400 shrink-0" />
        <p className="leading-snug text-slate-300">
          <strong className="text-teal-300 font-semibold">Academic inventory decision-support prototype:</strong> All demo datasets, replenishment policies, and simulation backtests are synthetic or simulated. Not affiliated with Blinkit, Zepto, or any commercial quick-commerce entities.
        </p>
      </div>
      <div className="hidden lg:flex items-center gap-3 text-[11px] text-teal-300 font-medium shrink-0 ml-4">
        <span>Daily Forecasting Horizon</span>
        <span>•</span>
        <span>Lead-Time (L+R) Periodic Review</span>
      </div>
    </div>
  );
};
