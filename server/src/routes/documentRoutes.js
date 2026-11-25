import { Router } from 'express';
import {
  extractTextFromPdfBuffer,
  normalizeDocumentText,
  pdfUpload,
} from '../services/pdfService.js';
import {
  answerDocumentQuestion,
  generateDocumentInsights,
  getActiveModel,
} from '../services/geminiService.js';

const router = Router();

function computeStats(text, pages = null) {
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  return {
    characters: text.length,
    words,
    ...(pages ? { pages } : {}),
  };
}

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    model: getActiveModel(),
    hasApiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
  });
});

router.post('/analyze', pdfUpload.single('file'), async (req, res, next) => {
  try {
    let documentText = '';
    let title = '';
    let sourceType = 'text';
    let pages = null;

    if (req.file) {
      sourceType = 'pdf';
      title = req.body?.title?.trim() || req.file.originalname || 'Uploaded PDF';
      const parsed = await extractTextFromPdfBuffer(req.file.buffer);
      documentText = parsed.text;
      pages = parsed.pages;
    } else {
      sourceType = 'text';
      title = req.body?.title?.trim() || 'Pasted Notes';
      documentText = normalizeDocumentText(req.body?.text);
      if (!documentText) {
        const error = new Error(
          'Please upload a PDF file or paste some document text to analyze.'
        );
        error.status = 400;
        throw error;
      }
    }

    const { summary, suggestedQuestions } = await generateDocumentInsights(
      documentText,
      title
    );

    res.json({
      title,
      sourceType,
      text: documentText,
      stats: computeStats(documentText, pages),
      summary,
      suggestedQuestions,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/chat', async (req, res, next) => {
  try {
    const { documentText, documentTitle, question, history } = req.body || {};
    const { answer } = await answerDocumentQuestion({
      documentText,
      documentTitle,
      question,
      history,
    });

    res.json({ answer });
  } catch (err) {
    next(err);
  }
});

export default router;
