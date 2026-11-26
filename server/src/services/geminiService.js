import { GoogleGenAI, Type } from '@google/genai';

export const GEMINI_MODEL = 'gemini-3.8-flash';
export const MODEL_TIMEOUT_MS = 7500;
export const MAX_PROMPT_DOCUMENT_CHARS = 8_000;
export const SUMMARY_MAX_OUTPUT_TOKENS = 750;
export const MAX_OUTPUT_TOKENS = 750;
const MAX_DOCUMENT_CHARS = 400_000;
const MAX_HISTORY_MESSAGES = 6;

const EXCLUDED_MODEL_TOKENS = [
  'gemma',
  'embedding',
  'imagen',
  'veo',
  'tts',
  'image',
  'audio',
  'live',
  'robotics',
  'computer-use',
  'customtools',
  'aqa',
];

// Module-level caches for live model list and the last working model
let activeWorkingModel = null;
let cachedAvailableModels = null;

export function getActiveModel() {
  return activeWorkingModel || GEMINI_MODEL;
}

export function resetActiveModel(model = null) {
  activeWorkingModel = model;
  cachedAvailableModels = null;
}

function tryParseJson(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function extractReadableErrorMessage(
  err,
  fallback = 'Failed to communicate with Gemini. Please try again.'
) {
  if (!err) return fallback;

  const candidates = [
    err?.error?.message,
    err?.response?.data?.error?.message,
    err?.message,
    typeof err === 'string' ? err : null,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      const parsed = tryParseJson(candidate);
      if (parsed) {
        const nested =
          parsed?.error?.message ||
          parsed?.message ||
          (typeof parsed?.error === 'string' ? parsed.error : null);
        if (nested && typeof nested === 'string') {
          return nested.trim();
        }
      }
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    } else if (typeof candidate === 'object' && candidate.message) {
      return String(candidate.message).trim();
    }
  }

  return fallback;
}

export function isTimeoutError(err) {
  if (!err) return false;
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return true;
  return /\btimed?\s*out\b|\baborted\b/i.test(String(err.message || ''));
}

export function getGeminiErrorStatus(err) {
  if (isTimeoutError(err)) return 504;

  const directStatus = Number(
    err?.status || err?.statusCode || err?.error?.code || err?.code
  );
  if (Number.isInteger(directStatus) && directStatus >= 400 && directStatus < 600) {
    return directStatus;
  }

  const parsed = tryParseJson(err?.message);
  const parsedStatus = Number(parsed?.error?.code || parsed?.code);
  if (Number.isInteger(parsedStatus) && parsedStatus >= 400 && parsedStatus < 600) {
    return parsedStatus;
  }

  const msg = String(err?.message || '');
  if (/\b503\b|UNAVAILABLE/i.test(msg)) return 503;
  if (/\b429\b|RESOURCE_EXHAUSTED/i.test(msg)) return 429;
  if (/\b404\b|NOT_FOUND/i.test(msg)) return 404;
  return null;
}

function shouldRotateModel(err, status) {
  return isTimeoutError(err) || status === 429 || status === 503 || status === 404;
}

function normalizeGeminiError(err) {
  const status = getGeminiErrorStatus(err) || 502;
  const message = isTimeoutError(err)
    ? 'Gemini request timed out. Please try again.'
    : extractReadableErrorMessage(err);
  const cleanError = new Error(message);
  cleanError.status = status;
  return cleanError;
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error(
      'GEMINI_API_KEY is not configured on the server. Add it to your .env file or Vercel Environment Variables.'
    );
    error.status = 503;
    throw error;
  }
  return new GoogleGenAI({ apiKey });
}

function validateDocumentText(documentText) {
  const text = String(documentText || '').trim();
  if (!text) {
    const error = new Error('Document text is required.');
    error.status = 400;
    throw error;
  }
  if (text.length > MAX_DOCUMENT_CHARS) {
    const error = new Error(
      `Document exceeds the maximum supported length of ${MAX_DOCUMENT_CHARS.toLocaleString()} characters.`
    );
    error.status = 400;
    throw error;
  }
  return text;
}

export function trimDocumentForPrompt(text) {
  if (text.length <= MAX_PROMPT_DOCUMENT_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_PROMPT_DOCUMENT_CHARS)}\n\n[Truncated to first ${MAX_PROMPT_DOCUMENT_CHARS.toLocaleString()} characters]`;
}

function normalizeModelId(name) {
  return String(name || '')
    .trim()
    .replace(/^models\//, '');
}

function extractVersionScore(lower) {
  const match = lower.match(/gemini-(\d+)(?:\.(\d+))?/);
  if (!match) return 0;
  const major = Number(match[1]) || 0;
  const minor = Number(match[2]) || 0;
  return major * 10 + minor;
}

function rankGeminiModel(modelId) {
  const lower = modelId.toLowerCase();
  let score = 0;

  // Put flash-lite and flash models first
  if (lower.includes('flash-lite')) score += 1000;
  else if (lower.includes('flash')) score += 900;
  else if (lower.includes('pro')) score += 200;

  // Prefer stable releases over preview/experimental
  if (!lower.includes('preview') && !lower.includes('exp') && !lower.includes('latest')) {
    score += 100;
  }

  // Prefer newer Gemini versions (e.g., 3.5 > 3.1 > 2.5 > 2.0)
  score += extractVersionScore(lower);

  return score;
}

export async function getAvailableGeminiModels(ai) {
  if (Array.isArray(cachedAvailableModels) && cachedAvailableModels.length > 0) {
    return cachedAvailableModels;
  }

  const rawModels = [];
  if (typeof ai?.models?.list === 'function') {
    const listResult = await ai.models.list({ config: { pageSize: 100 } });
    if (Array.isArray(listResult)) {
      rawModels.push(...listResult);
    } else if (listResult && typeof listResult[Symbol.asyncIterator] === 'function') {
      for await (const model of listResult) {
        rawModels.push(model);
      }
    } else if (Array.isArray(listResult?.page)) {
      rawModels.push(...listResult.page);
    } else if (Array.isArray(listResult?.models)) {
      rawModels.push(...listResult.models);
    }
  }

  const seen = new Set();
  const filtered = rawModels
    .filter((m) => {
      const id = normalizeModelId(m?.name);
      if (!id) return false;
      const lower = id.toLowerCase();
      if (!lower.startsWith('gemini-') || seen.has(lower)) return false;

      if (EXCLUDED_MODEL_TOKENS.some((token) => lower.includes(token))) {
        return false;
      }

      const supportsGenerate =
        !Array.isArray(m?.supportedActions) ||
        m.supportedActions.includes('generateContent');
      if (!supportsGenerate) return false;

      seen.add(lower);
      return true;
    })
    .map((m) => normalizeModelId(m.name))
    .sort((a, b) => rankGeminiModel(b) - rankGeminiModel(a));

  if (filtered.length > 0) {
    cachedAvailableModels = filtered;
  }
  return filtered;
}

export async function generateContentWithRetryAndFallback({
  ai,
  model,
  contents,
  config,
  timeoutMs = MODEL_TIMEOUT_MS,
}) {
  let availableModels = [];
  if (!model) {
    try {
      availableModels = await getAvailableGeminiModels(ai);
    } catch (listErr) {
      console.warn(
        '[DocuChat] Failed to list available Gemini models:',
        extractReadableErrorMessage(listErr)
      );
    }
  }

  const candidateOrder = [];
  const addCandidate = (id) => {
    if (id && !candidateOrder.includes(id)) {
      candidateOrder.push(id);
    }
  };

  if (model) {
    addCandidate(model);
  } else {
    if (activeWorkingModel) {
      addCandidate(activeWorkingModel);
    }
    for (const id of availableModels) {
      addCandidate(id);
    }
    if (candidateOrder.length === 0) {
      addCandidate(GEMINI_MODEL);
    }
  }

  let lastError = null;

  for (const candidateModel of candidateOrder) {
    try {
      const response = await ai.models.generateContent({
        model: candidateModel,
        contents,
        config: {
          ...config,
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });
      activeWorkingModel = candidateModel;
      return { response, modelUsed: candidateModel };
    } catch (err) {
      lastError = err;
      const status = getGeminiErrorStatus(err);

      if (!shouldRotateModel(err, status)) {
        throw normalizeGeminiError(err);
      }

      if (status === 404 && Array.isArray(cachedAvailableModels)) {
        cachedAvailableModels = cachedAvailableModels.filter((id) => id !== candidateModel);
      }

      const reason = isTimeoutError(err) ? `timeout (${timeoutMs}ms)` : status;
      console.warn(
        `[DocuChat] Model ${candidateModel} failed with ${reason}; rotating to next available Gemini model...`
      );
    }
  }

  throw normalizeGeminiError(lastError);
}

const INSIGHTS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Exactly 3 concise, direct bullet points summarizing the key takeaways of the document.',
    },
    suggestedQuestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Exactly 3 brief starter questions directly answerable from the document.',
    },
  },
  required: ['summary', 'suggestedQuestions'],
};

const DEFAULT_STARTER_QUESTIONS = [
  'What is the main topic and purpose of this document?',
  'What are the key findings, methods, or conclusions presented?',
  'What specific details, figures, or recommendations are highlighted?',
];

export function parseStructuredInsightsJson(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return null;
  }

  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const candidate = stripped.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function buildFallbackInsights(documentText, title = 'Untitled Document') {
  const cleaned = String(documentText || '')
    .replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20)
    .map((s) => (s.length > 220 ? `${s.slice(0, 217).trimEnd()}...` : s));

  const fallbackBullets = [
    sentences[0] || `Loaded document "${title}" (${cleaned.length.toLocaleString()} characters) for interactive analysis.`,
    sentences[1] || `Includes extracted text from "${title}" ready for grounded citation-backed Q&A.`,
    sentences[2] || `Use the chat panel to ask about specific sections, findings, definitions, or quotes from "${title}".`,
  ];

  return {
    summary: fallbackBullets.slice(0, 3),
    suggestedQuestions: [...DEFAULT_STARTER_QUESTIONS],
  };
}

export async function generateDocumentInsights(
  documentText,
  title = 'Untitled Document',
  options = {}
) {
  const validatedText = validateDocumentText(documentText);
  const promptText = trimDocumentForPrompt(validatedText);
  const ai = options.ai || getGeminiClient();

  const prompt = `Analyze the document "${title}" and return:
1. 3 brief bullet-point summary statements.
2. 3 concise starter questions directly answerable from the text.

<DOCUMENT title="${title}">
${promptText}
</DOCUMENT>`;

  const { response } = await generateContentWithRetryAndFallback({
    ai,
    model: options.model,
    contents: prompt,
    config: {
      temperature: 0.2,
      maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: INSIGHTS_SCHEMA,
      systemInstruction:
        'You are DocuChat. Be concise and direct. Base the 3 summary bullets and 3 questions strictly on the provided document.',
    },
    timeoutMs: options.timeoutMs,
  });

  const parsed = parseStructuredInsightsJson(response?.text);
  const fallback = buildFallbackInsights(validatedText, title);

  if (!parsed) {
    console.warn(
      '[DocuChat] Gemini structured summary JSON could not be parsed; using document-derived fallback insights.'
    );
    return fallback;
  }

  const parsedSummary = Array.isArray(parsed.summary)
    ? parsed.summary.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const parsedQuestions = Array.isArray(parsed.suggestedQuestions)
    ? parsed.suggestedQuestions.map((item) => String(item).trim()).filter(Boolean)
    : [];

  const summary =
    parsedSummary.length > 0
      ? [...parsedSummary, ...fallback.summary].slice(0, 3)
      : fallback.summary;
  const suggestedQuestions =
    parsedQuestions.length > 0
      ? [...parsedQuestions, ...fallback.suggestedQuestions].slice(0, 3)
      : fallback.suggestedQuestions;

  return { summary, suggestedQuestions };
}

export async function answerDocumentQuestion(
  {
    documentText,
    documentTitle = 'Untitled Document',
    question,
    history = [],
  },
  options = {}
) {
  const validatedText = validateDocumentText(documentText);
  const promptText = trimDocumentForPrompt(validatedText);
  const trimmedQuestion = String(question || '').trim();
  if (!trimmedQuestion) {
    const error = new Error('Please enter a question.');
    error.status = 400;
    throw error;
  }

  const ai = options.ai || getGeminiClient();

  const systemInstruction = `You are DocuChat, a concise document Q&A assistant.

RULES:
1. Give concise, direct answers based ONLY on the <DOCUMENT> below—never use outside knowledge or speculate.
2. Cite the relevant section and include brief verbatim quotes (short phrases in quotation marks or blockquotes) to support your answer.
3. If the answer is not in the <DOCUMENT>, politely state clearly that the document does not contain that information.

<DOCUMENT title="${documentTitle}">
${promptText}
</DOCUMENT>`;

  const sanitizedHistory = Array.isArray(history)
    ? history
        .slice(-MAX_HISTORY_MESSAGES)
        .filter(
          (msg) =>
            msg &&
            (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'model') &&
            typeof msg.content === 'string' &&
            msg.content.trim().length > 0
        )
        .map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: [{ text: msg.content.trim() }],
        }))
    : [];

  while (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== 'user') {
    sanitizedHistory.shift();
  }

  const contents = [
    ...sanitizedHistory,
    {
      role: 'user',
      parts: [{ text: trimmedQuestion }],
    },
  ];

  const { response } = await generateContentWithRetryAndFallback({
    ai,
    model: options.model,
    contents,
    config: {
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      systemInstruction,
    },
    timeoutMs: options.timeoutMs,
  });

  const answer = response.text?.trim();
  if (!answer) {
    const error = new Error('Gemini returned an empty response. Please try asking again.');
    error.status = 502;
    throw error;
  }

  return { answer };
}
