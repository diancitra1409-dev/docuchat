import multer from 'multer';
import {
  FormatError,
  InvalidPDFException,
  PDFParse,
  PasswordException,
} from 'pdf-parse';

export const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MIN_PDF_TEXT_LENGTH = 30;

const storage = multer.memoryStorage();

export const pdfUpload = multer({
  storage,
  limits: {
    fileSize: MAX_PDF_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = file.originalname?.toLowerCase().endsWith('.pdf');
    if (isPdfMime || isPdfExt) {
      cb(null, true);
    } else {
      const error = new Error('Only PDF files (.pdf) are supported.');
      error.status = 400;
      cb(error);
    }
  },
});

export function normalizeDocumentText(rawText) {
  return String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getSelectableTextLength(cleanedText) {
  // pdf-parse v2 appends "-- X of Y --" page separators even on blank/scanned pages
  return cleanedText
    .replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, '')
    .trim().length;
}

export async function extractTextFromPdfBuffer(buffer) {
  if (!buffer || buffer.length === 0) {
    const error = new Error('Uploaded PDF file is empty.');
    error.status = 400;
    throw error;
  }

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const cleanedText = normalizeDocumentText(result?.text);
    const selectableLength = getSelectableTextLength(cleanedText);

    if (!cleanedText || selectableLength < MIN_PDF_TEXT_LENGTH) {
      const error = new Error(
        'This PDF has no selectable text (it appears to be an image-only or scanned document). Please upload a text-based PDF or paste the text directly instead.'
      );
      error.status = 400;
      throw error;
    }

    return {
      text: cleanedText,
      pages: result?.total || result?.pages?.length || 1,
    };
  } catch (err) {
    if (err?.status) {
      throw err;
    }
    if (err instanceof PasswordException) {
      const error = new Error(
        'This PDF is password-protected. Please remove the password and try again.'
      );
      error.status = 400;
      throw error;
    }
    if (err instanceof InvalidPDFException || err instanceof FormatError) {
      const error = new Error(
        'Invalid or corrupted PDF file. Please upload a valid PDF document.'
      );
      error.status = 400;
      throw error;
    }
    const error = new Error('Failed to parse the uploaded PDF file.');
    error.status = 400;
    throw error;
  } finally {
    await parser.destroy().catch(() => {});
  }
}
