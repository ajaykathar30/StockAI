import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDatasets,
  triggerDemoSeed,
  uploadDatasetFile,
  activateDataset,
  getJobStatus
} from '../services/api';
import {
  UploadCloud,
  Sparkles,
  Database,
  CheckCircle,
  AlertTriangle,
  FileText,
  ExternalLink,
  Download,
  Info,
  Clock
} from 'lucide-react';

export const DatasetManagerPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{ percent: number; message: string; status: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Poll active background job if running
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
        queryClient.invalidateQueries({ queryKey: ['datasets'] });
        queryClient.invalidateQueries({ queryKey: ['overviewStats'] });
      }
      return job;
    },
    enabled: !!activeJobId,
    refetchInterval: 1500
  });

  const { data: datasets, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: getDatasets
  });

  const demoSeedMutation = useMutation({
    mutationFn: triggerDemoSeed,
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
    }
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return uploadDatasetFile(formData);
    },
    onSuccess: (data) => {
      setSelectedFile(null);
      setActiveJobId(data.jobId);
    }
  });

  const activateMutation = useMutation({
    mutationFn: activateDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      queryClient.invalidateQueries({ queryKey: ['overviewStats'] });
    }
  });

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
      } else {
        alert('Please upload a .csv file.');
      }
    }
  };

  const activeDataset = datasets?.find((d: any) => d.isActive) || datasets?.[0];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Dataset Manager & Provenance</h2>
        <p className="text-xs text-slate-500 mt-1">
          Import, validate, and audit quick-commerce retail sales and inventory datasets against canonical schema.
        </p>
      </div>

      {/* Background Job Progress Bar */}
      {jobProgress && (
        <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400 animate-spin" />
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                Job in progress ({jobProgress.status})
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

      {/* Dataset Actions: 1-Click Demo vs Manual CSV Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1-Click Synthetic Demo Generator */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                <Sparkles className="w-3.5 h-3.5" /> Offline Demo Generator
              </span>
              <span className="text-[11px] text-slate-400">Fixed Seed: 42</span>
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-2">
              Initialize Synthetic Dark Store Dataset
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Generates a reproducible benchmark of <strong>5 dark stores, 20 products, and 365 daily observations</strong> (36,500 rows). Simulates realistic day-of-week seasonality, promotional lifts, and historical stockout sales censoring.
            </p>
          </div>

          <button
            onClick={() => demoSeedMutation.mutate()}
            disabled={demoSeedMutation.isPending || !!activeJobId}
            className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {demoSeedMutation.isPending ? 'Queuing Generator...' : 'Generate Demo Dataset (36,500 Rows)'}
          </button>
        </div>

        {/* Manual CSV Upload */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                <UploadCloud className="w-3.5 h-3.5" /> CSV Ingestion
              </span>
              <span className="text-[11px] text-slate-400">Max size: 50MB</span>
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-2">
              Upload Custom Retail Sales CSV
            </h3>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-lg p-4 text-center cursor-pointer transition mb-4"
              onClick={() => document.getElementById('csvFileInput')?.click()}
            >
              <input
                id="csvFileInput"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-1" />
              {selectedFile ? (
                <p className="text-xs font-semibold text-teal-700">{selectedFile.name}</p>
              ) : (
                <>
                  <p className="text-xs font-medium text-slate-700">Drag & drop your CSV file here, or click to browse</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Supports canonical & Kaggle retail schemas</p>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
            disabled={!selectedFile || uploadMutation.isPending || !!activeJobId}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            {uploadMutation.isPending ? 'Validating CSV...' : 'Validate & Import Uploaded CSV'}
          </button>
        </div>
      </div>

      {/* Kaggle Download Instructions Accordion */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2 text-slate-800 font-bold text-sm">
          <Info className="w-4 h-4 text-teal-700" />
          <span>Kaggle Primary Dataset Integration Guide</span>
        </div>
        <p className="text-xs text-slate-600 mb-3">
          To test with external Kaggle data instead of the seeded demo dataset, download via the Kaggle CLI and upload the resulting CSV:
        </p>
        <div className="bg-slate-900 text-teal-300 font-mono text-xs p-3 rounded-lg overflow-x-auto select-all mb-3">
          kaggle datasets download -d atomicd/retail-store-inventory-and-demand-forecasting -p ./data/raw --unzip
        </div>
        <div className="text-[11px] text-slate-500 space-y-1">
          <p>• <strong>Primary source:</strong> atomicd/retail-store-inventory-and-demand-forecasting (sales_data.csv). Documented as synthetic estimated daily demand.</p>
          <p>• <strong>Alternative source:</strong> anirudhchauhan/retail-store-inventory-forecasting-dataset (retail_store_inventory.csv). Note: Exclude "Demand Forecast" from model training to prevent target proxy leakage.</p>
        </div>
      </div>

      {/* Active Dataset Validation & Provenance Report */}
      {activeDataset && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-slate-900">{activeDataset.name}</h3>
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Active
                </span>
                {activeDataset.isSynthetic && (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                    Synthetic
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">{activeDataset.provenance?.notes}</p>
            </div>

            {activeDataset.validationReport?.quarantineFilePath && (
              <a
                href={`/api/reports/download/${activeDataset.validationReport.quarantineFilePath.split('/').pop()}`}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200"
              >
                <Download className="w-3.5 h-3.5" />
                Download Quarantine CSV ({activeDataset.quarantineRowCount} rows)
              </a>
            )}
          </div>

          {/* Validation Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Total Rows</span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {activeDataset.rowCount?.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-emerald-700 font-medium uppercase">Valid Canonical Rows</span>
              <div className="text-xl font-bold text-emerald-900 mt-1">
                {activeDataset.validRowCount?.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-[11px] text-amber-700 font-medium uppercase">Quarantined Rows</span>
              <div className="text-xl font-bold text-amber-900 mt-1">
                {activeDataset.quarantineRowCount?.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-[11px] text-blue-700 font-medium uppercase">Stores / SKUs</span>
              <div className="text-xl font-bold text-blue-900 mt-1">
                {activeDataset.storeCount} stores • {activeDataset.productCount} SKUs
              </div>
            </div>
          </div>

          {/* Validation Warnings */}
          {activeDataset.validationReport?.warnings?.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-amber-900 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Validation Warnings & Data Quality Audits:</span>
              </div>
              <ul className="list-disc list-inside text-xs text-amber-800 space-y-1">
                {activeDataset.validationReport.warnings.map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
