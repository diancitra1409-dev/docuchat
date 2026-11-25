import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  FileUp,
  Loader2,
  NotebookPen,
  Sparkles,
  Upload,
} from 'lucide-react';
import SummaryCard from './SummaryCard';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DocumentPanel({
  documentData,
  isAnalyzing,
  analyzeError,
  onAnalyzePdf,
  onAnalyzeText,
  onLoadSample,
  onResetDocument,
  onSelectQuestion,
  isChatLoading,
}) {
  const [activeTab, setActiveTab] = useState('pdf');
  const [selectedFile, setSelectedFile] = useState(null);
  const [localError, setLocalError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [showSourceText, setShowSourceText] = useState(false);
  const fileInputRef = useRef(null);

  const errorMessage = localError || analyzeError;

  function validateAndSetFile(file) {
    setLocalError('');
    if (!file) return;

    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setSelectedFile(null);
      setLocalError('Only PDF files (.pdf) are supported.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setLocalError(
        `File "${file.name}" is ${formatFileSize(file.size)}. Maximum allowed PDF size is 5 MB.`
      );
      return;
    }

    setSelectedFile(file);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setActiveTab('pdf');
      validateAndSetFile(file);
    }
  }

  function handlePdfSubmit(e) {
    e.preventDefault();
    if (!selectedFile) {
      setLocalError('Please choose a PDF file first.');
      return;
    }
    setLocalError('');
    onAnalyzePdf(selectedFile);
  }

  function handleTextSubmit(e) {
    e.preventDefault();
    if (!noteText.trim()) {
      setLocalError('Please paste some text or notes to analyze.');
      return;
    }
    setLocalError('');
    onAnalyzeText({
      title: noteTitle.trim() || 'Pasted Notes',
      text: noteText,
    });
  }

  if (documentData) {
    return (
      <div className="space-y-4">
        {/* Active Document Metadata Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                    {documentData.sourceType === 'pdf' ? 'PDF Loaded' : 'Notes Loaded'}
                  </span>
                  {documentData.stats?.pages ? (
                    <span className="text-xs text-slate-500">
                      {documentData.stats.pages}{' '}
                      {documentData.stats.pages === 1 ? 'page' : 'pages'}
                    </span>
                  ) : null}
                  <span className="text-xs text-slate-500">
                    {documentData.stats?.words?.toLocaleString()} words
                  </span>
                </div>
                <h2 className="mt-1 truncate text-sm font-semibold text-slate-900 sm:text-base">
                  {documentData.title}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowSourceText(false);
                onResetDocument();
              }}
              className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
            >
              Change
            </button>
          </div>

          {/* Toggleable Source Text Preview */}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowSourceText((prev) => !prev)}
              className="flex w-full items-center justify-between text-xs font-medium text-slate-600 hover:text-indigo-600 cursor-pointer"
            >
              <span>
                {showSourceText ? 'Hide extracted document text' : 'View extracted document text'}
              </span>
              {showSourceText ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showSourceText && (
              <pre className="custom-scrollbar mt-2.5 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700">
                {documentData.text}
              </pre>
            )}
          </div>
        </div>

        {/* Summary & Suggested Questions */}
        <SummaryCard
          summary={documentData.summary}
          suggestedQuestions={documentData.suggestedQuestions}
          onSelectQuestion={onSelectQuestion}
          isChatLoading={isChatLoading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Add a Document
            </h2>
            <p className="text-xs text-slate-500">
              Upload a PDF (max 5 MB) or paste text to generate an instant summary &amp; Q&amp;A.
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('pdf');
              setLocalError('');
            }}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer sm:text-sm ${
              activeTab === 'pdf'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileUp className="h-4 w-4" />
            <span>Upload PDF</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('text');
              setLocalError('');
            }}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer sm:text-sm ${
              activeTab === 'text'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <NotebookPen className="h-4 w-4" />
            <span>Paste Notes</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 sm:text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {activeTab === 'pdf' ? (
          <form onSubmit={handlePdfSubmit} className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/70'
                  : 'border-slate-300 bg-slate-50/70 hover:border-indigo-400 hover:bg-indigo-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                <Upload className="h-6 w-6" />
              </div>

              {selectedFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatFileSize(selectedFile.size)} • Ready to analyze (click to replace)
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">
                    Drop your PDF here, or <span className="text-indigo-600">browse</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    PDF files up to 5 MB • Parsed in-memory with zero disk storage
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isAnalyzing || !selectedFile}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing PDF with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Analyze PDF &amp; Start Chat</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTextSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="doc-title"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                Document Title (optional)
              </label>
              <input
                id="doc-title"
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g., Q4 Product Strategy Notes"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="doc-text"
                  className="text-xs font-medium text-slate-700"
                >
                  Document Text / Notes
                </label>
                <span className="text-[11px] text-slate-400">
                  {noteText.length.toLocaleString()} chars
                </span>
              </div>
              <textarea
                id="doc-text"
                rows={8}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Paste meeting notes, articles, SOPs, contracts, or study material here..."
                className="custom-scrollbar w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isAnalyzing || !noteText.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Summarizing Notes with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Analyze Notes &amp; Start Chat</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* One-Click Sample Document Card */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex flex-col gap-2.5 rounded-xl bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 p-3.5 ring-1 ring-indigo-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-indigo-950">
                  Want to try DocuChat in one click?
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Load a realistic company Remote Work &amp; Employee SOP (SOP-HR-204).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLoadSample}
              disabled={isAnalyzing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isAnalyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>Load Sample Document</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
