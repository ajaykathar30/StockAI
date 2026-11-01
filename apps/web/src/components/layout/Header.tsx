import React from 'react';
import { AlertCircle, User, Activity } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  isSynthetic?: boolean;
  target?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  isSynthetic = true,
  target = 'units_sold'
}) => {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Synthetic/Simulated Data Badge */}
        {isSynthetic ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Synthetic demo data
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Imported Dataset
          </span>
        )}

        {/* Target Indicator */}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <Activity className="w-3.5 h-3.5 text-teal-600" />
          Target: {target === 'units_sold' ? 'Observed-sales' : 'Estimated-demand'}
        </span>

        {/* Analyst Pill */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-semibold text-xs border border-teal-200">
            <User className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium text-slate-700 hidden sm:inline">
            Inventory Analyst
          </span>
        </div>
      </div>
    </header>
  );
};
