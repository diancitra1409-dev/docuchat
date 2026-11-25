import React from 'react';
import { FileText, RotateCcw, Sparkles } from 'lucide-react';

export default function Header({
  documentData,
  isAnalyzing,
  onLoadSample,
  onResetDocument,
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                DocuChat
              </h1>
              <span className="hidden rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200/70 sm:inline-flex">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Smart Document Q&amp;A — Chat with PDF &amp; Notes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!documentData ? (
            <button
              type="button"
              onClick={onLoadSample}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Load Sample Document</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onResetDocument}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>New Document</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
