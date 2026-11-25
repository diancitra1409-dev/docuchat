import { GoogleGenAI, Type } from '@google/genai';

export const GEMINI_MODEL = 'gemini-3.8-flash';
export const RETRY_DELAYS_MS = [700, 1500];
export const MAX_PROMPT_DOCUMENT_CHARS = 15_000;
export const SUMMARY_MAX_OUTPUT_TOKENS = 1500;
export const MAX_OUTPUT_TOKENS = 600;
const MAX_DOCUMENT_CHARS = 400_000;
const MAX_HISTORY_MESSAGES = 6;
const NON_TEXT_MODEL_TOKENS = [
  'tts',
  'image',
  'audio',
  'live',
  'robotics',
  'computer-use',
  'customtools',
  'embedding',
  'aqa',
];

// Module-level cache so once primary model fails with 503/429,
// subsequent requests skip it and reuse the working flash/flash-lite model.
let activeWorkingModel = GEMINI_MODEL;
let cachedFallbackModels = null;

export function getActiveModel() {
  return activeWorkingModel;
}

export function resetActiveModel(model = GEMINI_MODEL) {
  activeWorkingModel = model;
  cachedFallbackModels = null;
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export function getGeminiErrorStatus(err) {
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
  return null;
}

function isRetryableStatus(status) {
  return status === 503 || status === 429;
}

function normalizeGeminiError(err) {
  const status = getGeminiErrorStatus(err) || 502;
  const message = extractReadableErrorMessage(err);
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

function rankFallbackModel(modelId) {
  const lower = modelId.toLowerCase();
  let score = 0;
  if (lower.includes('flash') && !lower.includes('lite')) score += 40;
  if (lower.includes('flash-lite')) score += 35;
  if (!lower.includes('preview') && !lower.includes('exp')) score += 20;
  if (lower.includes('2.5')) score += 15;
  else if (lower.includes('3')) score += 12;
  else if (lower.includes('2.0')) score += 10;
  return score;
}

export async function findFallbackFlashModels(ai, failedModel = GEMINI_MODEL) {
  if (Array.isArray(cachedFallbackModels) && cachedFallbackModels.length > 0) {
    return cachedFallbackModels.filter(
      (id) => id.toLowerCase() !== normalizeModelId(failedModel).toLowerCase()
    );
  }

  const models = [];
  const listResult = await ai.models.list({ config: { pageSize: 100 } });

  if (Array.isArray(listResult)) {
    models.push(...listResult);
  } else if (listResult && typeof listResult[Symbol.asyncIterator] === 'function') {
    for await (const model of listResult) {
      models.push(model);
    }
  } else if (Array.isArray(listResult?.page)) {
    models.push(...listResult.page);
  } else if (Array.isArray(listResult?.models)) {
    models.push(...listResult.models);
  }

  const normalizedPrimary = normalizeModelId(GEMINI_MODEL).toLowerCase();
  const normalizedFailed = normalizeModelId(failedModel).toLowerCase();
  const seen = new Set();

  const ranked = models
    .filter((m) => {
      const id = normalizeModelId(m?.name);
      if (!id) return false;
      const lower = id.toLowerCase();
      if (lower === normalizedPrimary || seen.has(lower)) return false;

      const supportsGenerate =
        !Array.isArray(m?.supportedActions) ||
        m.supportedActions.includes('generateContent');
      if (!supportsGenerate) return false;

      if (!lower.includes('gemini') || !lower.includes('flash')) return false;
      if (NON_TEXT_MODEL_TOKENS.some((token) => lower.includes(token))) return false;

      seen.add(lower);
      return true;
    })
    .map((m) => normalizeModelId(m.name))
    .sort((a, b) => rankFallbackModel(b) - rankFallbackModel(a));

  cachedFallbackModels = ranked;
  return ranked.filter((id) => id.toLowerCase() !== normalizedFailed);
}

async function callModelWithFastRetries({
  ai,
  model,
  contents,
  config,
  retryDelaysMs,
  sleep,
}) {
  let lastError = null;
  let lastStatus = null;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      return { response };
    } catch (err) {
      lastError = err;
      lastStatus = getGeminiErrorStatus(err);

      if (!isRetryableStatus(lastStatus) || attempt === retryDelaysMs.length) {
        break;
      }

      const delayMs = retryDelaysMs[attempt];
      console.warn(
        `[DocuChat] Gemini ${model} returned ${lastStatus} (attempt ${attempt + 1}/${retryDelaysMs.length + 1}). Retrying in ${delayMs}ms...`
      );
      await sleep(delayMs);
    }
  }

  const wrapped = lastError || new Error('Gemini request failed.');
  wrapped._geminiStatus = lastStatus;
  throw wrapped;
}

export async function generateContentWithRetryAndFallback({
  ai,
  model,
  contents,
  config,
  retryDelaysMs = RETRY_DELAYS_MS,
  sleep = defaultSleep,
}) {
  const targetModel = model || activeWorkingModel;
  let lastError = null;
  let lastStatus = null;

  // When targetModel is the primary gemini-3.8-flash and hits 503/429,
  // immediately switch to an available flash/flash-lite fallback and cache it.
  if (targetModel === GEMINI_MODEL) {
    try {
      const response = await ai.models.generateContent({
        model: targetModel,
        contents,
        config,
      });
      return { response, modelUsed: targetModel };
    } catch (err) {
      lastError = err;
      lastStatus = getGeminiErrorStatus(err);

      if (!isRetryableStatus(lastStatus)) {
        throw normalizeGeminiError(err);
      }

      let fallbackModels = [];
      try {
        fallbackModels = await findFallbackFlashModels(ai, targetModel);
      } catch (listErr) {
        console.warn(
          '[DocuChat] Failed to list fallback models:',
          extractReadableErrorMessage(listErr)
        );
      }

      if (fallbackModels.length > 0) {
        const primaryStatus = lastStatus;
        for (const fallbackModel of fallbackModels.slice(0, 3)) {
          try {
            console.warn(
              `[DocuChat] ${targetModel} returned ${primaryStatus}; switching & caching active model -> ${fallbackModel}`
            );
            const { response } = await callModelWithFastRetries({
              ai,
              model: fallbackModel,
              contents,
              config,
              retryDelaysMs,
              sleep,
            });
            activeWorkingModel = fallbackModel;
            return { response, modelUsed: fallbackModel };
          } catch (fallbackErr) {
            lastError = fallbackErr;
            lastStatus = fallbackErr?._geminiStatus || getGeminiErrorStatus(fallbackErr);
          }
        }
        throw normalizeGeminiError(lastError);
      }

      // No fallback models found; do fast retries on primary model
      for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
        await sleep(retryDelaysMs[attempt]);
        try {
          const response = await ai.models.generateContent({
            model: targetModel,
            contents,
            config,
          });
          return { response, modelUsed: targetModel };
        } catch (retryErr) {
          lastError = retryErr;
          lastStatus = getGeminiErrorStatus(retryErr);
          if (!isRetryableStatus(lastStatus)) break;
        }
      }

      throw normalizeGeminiError(lastError);
    }
  }

  // Already using a cached fallback model: retry up to 2 times (700ms, 1500ms)
  try {
    const { response } = await callModelWithFastRetries({
      ai,
      model: targetModel,
      contents,
      config,
      retryDelaysMs,
      sleep,
    });
    return { response, modelUsed: targetModel };
  } catch (err) {
    lastError = err;
    lastStatus = err?._geminiStatus || getGeminiErrorStatus(err);

    if (isRetryableStatus(lastStatus)) {
      let fallbackModels = [];
      try {
        fallbackModels = await findFallbackFlashModels(ai, targetModel);
      } catch {
        fallbackModels = [];
      }

      for (const fallbackModel of fallbackModels.slice(0, 2)) {
        try {
          const response = await ai.models.generateContent({
            model: fallbackModel,
            contents,
            config,
          });
          activeWorkingModel = fallbackModel;
          return { response, modelUsed: fallbackModel };
        } catch (fallbackErr) {
          lastError = fallbackErr;
        }
      }
    }

    throw normalizeGeminiError(lastError);
  }
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
    sentences[1] || `Includes full extracted text from "${title}" ready for grounded citation-backed Q&A.`,
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
    retryDelaysMs: options.retryDelaysMs,
    sleep: options.sleep,
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
    retryDelaysMs: options.retryDelaysMs,
    sleep: options.sleep,
  });

  const answer = response.text?.trim();
  if (!answer) {
    const error = new Error('Gemini returned an empty response. Please try asking again.');
    error.status = 502;
    throw error;
  }

  return { answer };
}
