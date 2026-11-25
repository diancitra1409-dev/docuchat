import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  Copy,
  FileSearch,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

export default function ChatPanel({
  documentData,
  messages,
  isChatLoading,
  chatError,
  onSendMessage,
  onClearChat,
  onDismissError,
  onLoadSample,
  isAnalyzing,
}) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isChatLoading || !documentData) return;
    setInput('');
    onSendMessage(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  async function handleCopy(id, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard may be unavailable in non-secure contexts
    }
  }

  if (!documentData) {
    return (
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
          <FileSearch className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          Ask Questions Grounded in Your Document
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          Upload a PDF or paste your notes on the left. DocuChat summarizes key points automatically and answers follow-up questions with exact section quotes.
        </p>

        <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-3 text-left sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold text-slate-900">1. Load Content</p>
            <p className="mt-1 text-xs text-slate-500">
              Upload up to 5 MB PDFs or paste raw notes.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold text-slate-900">2. Auto Summary</p>
            <p className="mt-1 text-xs text-slate-500">
              Get 3 key bullets &amp; 3 clickable questions.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold text-slate-900">3. Cited Q&amp;A</p>
            <p className="mt-1 text-xs text-slate-500">
              Answers strictly cite quotes—no hallucinations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLoadSample}
          disabled={isAnalyzing}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 cursor-pointer"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span>Load Sample Document</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[680px] max-h-[calc(100vh-8.5rem)] min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">
              Q&amp;A Chat
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span className="truncate">
                Strictly grounded in &ldquo;{documentData.title}&rdquo;
              </span>
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearChat}
            disabled={isChatLoading}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-800 disabled:opacity-50 cursor-pointer"
            title="Clear conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Chat Messages Area */}
      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-slate-50/40 p-4 sm:p-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-900">
              Document ready for questions
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              Ask anything about <span className="font-medium text-slate-700">{documentData.title}</span>, or click one of the suggested questions on the left.
            </p>

            {documentData.suggestedQuestions?.length > 0 && (
              <div className="mt-4 flex max-w-lg flex-wrap justify-center gap-2">
                {documentData.suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isChatLoading}
                    onClick={() => onSendMessage(q)}
                    className="rounded-full border border-indigo-200 bg-white px-3.5 py-1.5 text-xs font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] rounded-2xl px-4 py-3 ${
                    isUser
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'border border-slate-200/90 bg-white text-slate-800 shadow-sm'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.content}
                    </p>
                  ) : (
                    <>
                      <MarkdownRenderer content={msg.content} />
                      <div className="mt-2 flex items-center justify-end border-t border-slate-100 pt-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-600">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {isUser && (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isChatLoading && (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              <span>Checking document and citing sources...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Error Banner */}
      {chatError && (
        <div className="flex items-center justify-between gap-2 border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{chatError}</span>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="font-semibold text-red-700 underline hover:text-red-900 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 bg-white p-3 sm:p-4"
      >
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isChatLoading}
            placeholder="Ask a question about this document... (Enter to send)"
            className="custom-scrollbar max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isChatLoading || !input.trim()}
            aria-label="Send message"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 cursor-pointer"
          >
            {isChatLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
