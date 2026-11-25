import React from 'react';
import { ArrowUpRight, ListChecks, MessageSquarePlus, Sparkles } from 'lucide-react';

export default function SummaryCard({
  summary = [],
  suggestedQuestions = [],
  onSelectQuestion,
  isChatLoading,
}) {
  return (
    <div className="space-y-4">
      {/* 3-Bullet Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ListChecks className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Document Summary
            </h2>
            <p className="text-xs text-slate-500">
              Auto-generated 3-point overview
            </p>
          </div>
        </div>

        <ul className="space-y-2.5">
          {summary.map((bullet, index) => (
            <li
              key={index}
              className="flex items-start gap-2.5 rounded-xl bg-slate-50/80 px-3 py-2.5 text-sm leading-relaxed text-slate-700"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">
                {index + 1}
              </span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 3 Clickable Suggested Questions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Suggested Questions
            </h2>
            <p className="text-xs text-slate-500">
              Click any question to ask DocuChat
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {suggestedQuestions.map((question, index) => (
            <button
              key={index}
              type="button"
              disabled={isChatLoading}
              onClick={() => onSelectQuestion(question)}
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/70 hover:text-indigo-900 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <span className="flex items-start gap-2.5">
                <MessageSquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500 transition group-hover:text-indigo-600" />
                <span>{question}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-indigo-600" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
