import React, { useState } from 'react';
import Header from './components/Header';
import DocumentPanel from './components/DocumentPanel';
import ChatPanel from './components/ChatPanel';
import {
  analyzePdfFile,
  analyzeTextDocument,
  askDocumentQuestion,
  formatErrorMessage,
} from './api/docuchatApi';
import { SAMPLE_DOCUMENT } from './data/sampleDocument';

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [documentData, setDocumentData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  const [messages, setMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  async function runDocumentAnalysis(analyzeFn) {
    setIsAnalyzing(true);
    setAnalyzeError('');
    setChatError('');

    try {
      const result = await analyzeFn();
      setDocumentData(result);
      setMessages([]);
    } catch (err) {
      setAnalyzeError(formatErrorMessage(err, 'Failed to analyze document.'));
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleAnalyzePdf(file) {
    return runDocumentAnalysis(() => analyzePdfFile(file));
  }

  function handleAnalyzeText({ title, text }) {
    return runDocumentAnalysis(() => analyzeTextDocument({ title, text }));
  }

  function handleLoadSample() {
    return runDocumentAnalysis(() =>
      analyzeTextDocument({
        title: SAMPLE_DOCUMENT.title,
        text: SAMPLE_DOCUMENT.text,
      })
    );
  }

  function handleResetDocument() {
    setDocumentData(null);
    setMessages([]);
    setAnalyzeError('');
    setChatError('');
  }

  async function handleSendMessage(questionText) {
    if (!documentData || isChatLoading) return;

    const userMessage = {
      id: createMessageId(),
      role: 'user',
      content: questionText,
    };

    const recentHistory = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setIsChatLoading(true);
    setChatError('');

    try {
      const { answer } = await askDocumentQuestion({
        documentText: documentData.text,
        documentTitle: documentData.title,
        question: questionText,
        history: recentHistory,
      });

      const assistantMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: answer,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setChatError(
        formatErrorMessage(err, 'Failed to get an answer from DocuChat.')
      );
    } finally {
      setIsChatLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header
        documentData={documentData}
        isAnalyzing={isAnalyzing}
        onLoadSample={handleLoadSample}
        onResetDocument={handleResetDocument}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <section className="lg:col-span-5">
            <DocumentPanel
              documentData={documentData}
              isAnalyzing={isAnalyzing}
              analyzeError={analyzeError}
              onAnalyzePdf={handleAnalyzePdf}
              onAnalyzeText={handleAnalyzeText}
              onLoadSample={handleLoadSample}
              onResetDocument={handleResetDocument}
              onSelectQuestion={handleSendMessage}
              isChatLoading={isChatLoading}
            />
          </section>

          <section className="lg:col-span-7">
            <ChatPanel
              documentData={documentData}
              messages={messages}
              isChatLoading={isChatLoading}
              chatError={chatError}
              onSendMessage={handleSendMessage}
              onClearChat={() => {
                setMessages([]);
                setChatError('');
              }}
              onDismissError={() => setChatError('')}
              onLoadSample={handleLoadSample}
              isAnalyzing={isAnalyzing}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
