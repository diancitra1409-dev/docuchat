import multer from 'multer';
import {
  extractReadableErrorMessage,
  getGeminiErrorStatus,
} from '../services/geminiService.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'PDF file exceeds the 5MB size limit. Please upload a smaller file.',
      });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON request payload.' });
  }

  const status =
    err?.status || err?.statusCode || getGeminiErrorStatus(err) || 500;
  const message = extractReadableErrorMessage(
    err,
    'An unexpected server error occurred. Please try again.'
  );

  if (status >= 500) {
    console.error('[DocuChat Server Error]', err);
  }

  return res.status(status).json({ error: message });
}
