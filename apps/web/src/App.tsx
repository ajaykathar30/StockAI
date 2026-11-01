import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AcademicNoticeBanner } from './components/layout/AcademicNoticeBanner';

import { OverviewPage } from './pages/OverviewPage';
import { DatasetManagerPage } from './pages/DatasetManagerPage';
import { StoresProductsPage } from './pages/StoresProductsPage';
import { ForecastExplorerPage } from './pages/ForecastExplorerPage';
import { ReplenishmentPlannerPage } from './pages/ReplenishmentPlannerPage';
import { ModelLabPage } from './pages/ModelLabPage';
import { SimulationLabPage } from './pages/SimulationLabPage';
import { ReportsPage } from './pages/ReportsPage';
import { AboutPage } from './pages/AboutPage';

import { getActiveDataset } from './services/api';

const PAGE_METADATA: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Executive Overview', subtitle: 'Network-wide inventory posture and demand indicators' },
  '/datasets': { title: 'Dataset Manager', subtitle: 'Schema validation, provenance tracking, and quarantine isolation' },
  '/stores-products': { title: 'Stores & Products Catalog', subtitle: 'Dark store inventory configuration and lead-time review parameters' },
  '/forecasts': { title: 'Forecast Explorer', subtitle: 'Time-safe multi-step recursive demand predictions and uncertainty intervals' },
  '/replenishment': { title: 'Replenishment Planner', subtitle: 'Periodic review (R, S) order-up-to recommendations with MOQ and shelf-life constraints' },
  '/models': { title: 'Model Lab & Benchmarks', subtitle: 'Chronological evaluation comparing rule-based baselines with LightGBM and XGBoost' },
  '/simulation': { title: 'Simulation Lab', subtitle: 'Discrete-event inventory backtesting and policy cost comparison' },
  '/reports': { title: 'Reports & Data Exports', subtitle: 'ReportLab PDF executive summaries and formula-escaped CSV datasets' },
  '/about': { title: 'Academic Documentation & Team', subtitle: 'Methodological boundaries, system architecture, and student team credits' },
};

export const App: React.FC = () => {
  const location = useLocation();
  const currentMeta = PAGE_METADATA[location.pathname] || PAGE_METADATA['/'];

  const { data: activeDataset } = useQuery({
    queryKey: ['activeDataset'],
    queryFn: getActiveDataset
  });

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Top Academic Disclaimer Ribbon */}
      <AcademicNoticeBanner />

      <div className="flex flex-1 overflow-hidden">
        {/* Persistent Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header
            title={currentMeta.title}
            subtitle={currentMeta.subtitle}
            isSynthetic={activeDataset?.isSynthetic ?? true}
            target={activeDataset?.defaultTarget || 'units_sold'}
          />

          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/datasets" element={<DatasetManagerPage />} />
              <Route path="/stores-products" element={<StoresProductsPage />} />
              <Route path="/forecasts" element={<ForecastExplorerPage />} />
              <Route path="/replenishment" element={<ReplenishmentPlannerPage />} />
              <Route path="/models" element={<ModelLabPage />} />
              <Route path="/simulation" element={<SimulationLabPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};
