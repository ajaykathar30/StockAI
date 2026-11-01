import React from 'react';
import {
  Info,
  Users,
  Layers,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Code
} from 'lucide-react';

const TEAM_MEMBERS = [
  { name: 'Udaynoor Singh', id: 'IIT2024006', role: 'Machine Learning & Forecasting Pipelines' },
  { name: 'Disha Gupta', id: 'IIT2024039', role: 'Data Validation & Provenance Architecture' },
  { name: 'Ravindra Chaudhary', id: 'IIT2024056', role: 'Inventory Replenishment & Decision Engine' },
  { name: 'Tanishq Garg', id: 'IIT2024038', role: 'Discrete-Event Simulator & Backtesting' },
  { name: 'Ajay Kathar', id: 'IIT2024037', role: 'Full-Stack Architecture & API Integration' },
  { name: 'Abhijeet Jain', id: 'IIT2024044', role: 'Quality Assurance & Empirical Evaluation' }
];

export const AboutPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Settings & Academic Documentation</h2>
        <p className="text-xs text-slate-500 mt-1">
          System architecture, research methodology, academic boundaries, and project team attributions.
        </p>
      </div>

      {/* Research Team Grid */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Users className="w-5 h-5 text-teal-700" />
          <h3 className="font-bold text-base text-slate-900">Project Research Team</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {TEAM_MEMBERS.map((m) => (
            <div key={m.id} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-bold text-sm text-slate-900">{m.name}</div>
              <div className="text-xs font-mono font-semibold text-teal-700">{m.id}</div>
              <div className="text-xs text-slate-500 mt-2">{m.role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Academic Boundaries & Disclaimers */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-base text-slate-900">Academic Prototype Scope & Limitations</h3>
        </div>

        <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
          <p>
            <strong>1. Academic Inventory Decision-Support Prototype:</strong> This software is engineered strictly as an educational and academic prototype exploring inventory decision-support algorithms. It is not affiliated with, endorsed by, or integrated with commercial quick-commerce operators (e.g., Blinkit or Zepto).
          </p>
          <p>
            <strong>2. Synthetic Data & Censoring Limitations:</strong> The primary dataset and demo generators are synthetic. Documented historical sales reflect stockout censoring; observed sales are not assumed to equal unconstrained customer demand during historical stock-out events.
          </p>
          <p>
            <strong>3. Daily Forecasting Frequency:</strong> Models operate on daily aggregations. In keeping with empirical academic integrity, no synthetic hourly records or shift-level claims are fabricated.
          </p>
          <p>
            <strong>4. Local Planning Records:</strong> Generated purchase recommendations and approvals represent internal planning records only. No external purchase orders, EDI transmissions, or supplier API communications occur.
          </p>
          <p>
            <strong>5. Prediction Intervals:</strong> Uncertainty bands are computed using empirical conformal residual quantiles on validation splits. They do not constitute asymptotic or guaranteed theoretical confidence intervals.
          </p>
        </div>
      </div>

      {/* Architecture Summary */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Layers className="w-5 h-5 text-teal-700" />
          <h3 className="font-bold text-base text-slate-900">Multi-Tier System Architecture</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-sm">Frontend Layer</h4>
            <ul className="text-slate-600 space-y-1">
              <li>• React 18 with TypeScript</li>
              <li>• Vite build tool</li>
              <li>• Tailwind CSS & custom brand tokens</li>
              <li>• Recharts interactive data visualization</li>
              <li>• TanStack Query for asynchronous server state</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-sm">Node.js API Gateway</h4>
            <ul className="text-slate-600 space-y-1">
              <li>• Express with TypeScript</li>
              <li>• Mongoose & MongoDB (Atlas/Local)</li>
              <li>• JWT cookie authentication & Bcrypt</li>
              <li>• Helmet, CORS, and rate limiting</li>
              <li>• Async background job manager</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-sm">Python ML Microservice</h4>
            <ul className="text-slate-600 space-y-1">
              <li>• FastAPI & Pydantic</li>
              <li>• LightGBM & XGBoost regressors</li>
              <li>• Scikit-learn, Pandas, and NumPy</li>
              <li>• Discrete-event inventory simulator</li>
              <li>• ReportLab PDF publication generator</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Dataset Sources */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
          <ExternalLink className="w-4 h-4 text-teal-700" />
          <span>Primary External Dataset Citations</span>
        </div>
        <p>
          • <strong>Primary Benchmark:</strong> <em>Retail Store Inventory and Demand Forecasting</em> (<a href="https://www.kaggle.com/datasets/atomicd/retail-store-inventory-and-demand-forecasting" target="_blank" rel="noreferrer" className="text-teal-700 font-semibold underline">atomicd/retail-store-inventory-and-demand-forecasting</a>).
        </p>
        <p>
          • <strong>Alternative Benchmark:</strong> <em>Retail Store Inventory Forecasting Dataset</em> (<a href="https://www.kaggle.com/datasets/anirudhchauhan/retail-store-inventory-forecasting-dataset" target="_blank" rel="noreferrer" className="text-teal-700 font-semibold underline">anirudhchauhan/retail-store-inventory-forecasting-dataset</a>).
        </p>
      </div>
    </div>
  );
};
