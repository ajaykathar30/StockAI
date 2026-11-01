import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  Store,
  LineChart,
  Boxes,
  Cpu,
  FlaskConical,
  FileSpreadsheet,
  Info
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/datasets', label: 'Dataset Manager', icon: Database },
  { to: '/stores-products', label: 'Stores & Products', icon: Store },
  { to: '/forecasts', label: 'Forecast Explorer', icon: LineChart },
  { to: '/replenishment', label: 'Replenishment Planner', icon: Boxes },
  { to: '/models', label: 'Model Lab', icon: Cpu },
  { to: '/simulation', label: 'Simulation Lab', icon: FlaskConical },
  { to: '/reports', label: 'Reports & Exports', icon: FileSpreadsheet },
  { to: '/about', label: 'Settings & About', icon: Info },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-slate-950 font-bold text-lg shadow-md shadow-teal-500/20">
            Q
          </div>
          <div>
            <span className="font-bold text-white tracking-tight text-base">QUICKSTOCK</span>
            <span className="text-teal-400 font-semibold text-xs ml-1 px-1.5 py-0.5 rounded bg-teal-950/80 border border-teal-800">
              AI
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-1 font-medium">
          Dark Store Decision Support
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-400">QuickStock AI</span>
          <span className="text-[10px] text-teal-400 font-mono">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
