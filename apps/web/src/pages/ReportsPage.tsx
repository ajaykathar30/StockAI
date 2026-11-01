import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { generatePdfReport } from '../services/api';
import {
  FileText,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [generatedPdf, setGeneratedPdf] = useState<string | null>(null);

  const pdfMutation = useMutation({
    mutationFn: generatePdfReport,
    onSuccess: (data) => {
      setGeneratedPdf(data.filename);
    }
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Reports & Data Exports</h2>
        <p className="text-xs text-slate-500 mt-1">
          Export publication-ready academic PDF executive summaries and formula-escaped CSV files.
        </p>
      </div>

      {/* Report Generation Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* PDF Executive Summary */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-1">Academic Executive PDF</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Publication-grade PDF summary generated using ReportLab in Python. Includes model leaderboard metrics, dataset provenance, replenishment schedule, and team attributions.
            </p>
          </div>

          <div className="space-y-2">
            {generatedPdf ? (
              <a
                href={`/api/reports/download/${generatedPdf}`}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                Download Ready PDF ({generatedPdf.substring(0, 18)}...)
              </a>
            ) : (
              <button
                onClick={() => pdfMutation.mutate()}
                disabled={pdfMutation.isPending}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                {pdfMutation.isPending ? 'Generating PDF with ReportLab...' : 'Generate New PDF Report'}
              </button>
            )}
          </div>
        </div>

        {/* Forecast CSV Export */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-1">Forecast Trajectory CSV</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Export complete multi-step daily demand forecasts including lower (10th) and upper (90th) uncertainty bounds. Cleanly escaped against spreadsheet formula injection (CWE-1236).
            </p>
          </div>

          <a
            href="/api/reports/export/forecast-csv"
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4" />
            Download Forecast CSV
          </a>
        </div>

        {/* Replenishment Plan CSV Export */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-1">Replenishment Plan CSV</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Export audited periodic review replenishment schedules with case-pack rounding, MOQ calculations, safety stock buffers, and formula explanations.
            </p>
          </div>

          <a
            href="/api/reports/export/replenishment-csv"
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4" />
            Download Replenishment CSV
          </a>
        </div>
      </div>

      {/* ReportLab Methodology Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
          <Info className="w-4 h-4 text-teal-700" />
          <span>Report Generation Technology</span>
        </div>
        <p>
          Executive PDF summaries are rendered directly within the Python ML service via <strong>ReportLab 5.1</strong>. Data inputs reflect strictly evaluated model runs, validation quarantine counts, and simulated policy results. No artificial metrics or static placeholders are used.
        </p>
      </div>
    </div>
  );
};
