const API_BASE = '/api';

function extractReadableError(payload, fallbackMessage) {
  if (!payload) return fallbackMessage;

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return fallbackMessage;
    try {
      const parsed = JSON.parse(trimmed);
      return extractReadableError(parsed, trimmed);
    } catch {
      return trimmed;
    }
  }

  if (typeof payload === 'object') {
    if (payload.error !== undefined) {
      return extractReadableError(payload.error, fallbackMessage);
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return extractReadableError(payload.message, fallbackMessage);
    }
  }

  return fallbackMessage;
}

export function formatErrorMessage(
  err,
  fallbackMessage = 'Something went wrong. Please try again.'
) {
  if (!err) return fallbackMessage;
  return extractReadableError(err.message ?? err, fallbackMessage);
}

async function parseJsonResponse(response) {
  const rawText = await response.text();
  let data = null;

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const fallback = `Request failed with status ${response.status}. Please try again.`;
    const message = extractReadableError(data ?? rawText, fallback);
    throw new Error(message);
  }

  return data;
}

export async function checkApiHealth() {
  const response = await fetch(`${API_BASE}/health`);
  return parseJsonResponse(response);
}

export async function analyzePdfFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', file.name);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    body: formData,
  });

  return parseJsonResponse(response);
}

export async function analyzeTextDocument({ text, title }) {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, title }),
  });

  return parseJsonResponse(response);
}

export async function askDocumentQuestion({
  documentText,
  documentTitle,
  question,
  history,
}) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentText,
      documentTitle,
      question,
      history,
    }),
  });

  return parseJsonResponse(response);
}
