import multer from 'multer';

export const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MIN_PDF_TEXT_LENGTH = 30;
export const MAX_PDF_TEXT_CHARS = 8_000;

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

export async function extractTextFromPdfBuffer(buffer) {
  if (!buffer || buffer.length === 0) {
    const error = new Error('Uploaded PDF file is empty.');
    error.status = 400;
    throw error;
  }

  let pdf = null;
  try {
    const { getDocumentProxy } = await import('unpdf');
    pdf = await getDocumentProxy(new Uint8Array(buffer));

    const totalPages = pdf.numPages || 1;
    const pageTexts = [];
    let collectedChars = 0;

    // Stop reading pages as soon as we have 8,000 characters so large PDFs finish in milliseconds.
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const textContent = await page.getTextContent();
        const rawPageText = textContent.items
          .filter((item) => item.str != null)
          .map((item) => item.str + (item.hasEOL ? '\n' : ''))
          .join('');
        const normalizedPage = normalizeDocumentText(rawPageText);
        if (normalizedPage) {
          pageTexts.push(normalizedPage);
          collectedChars += normalizedPage.length + 2;
        }
      } finally {
        page.cleanup?.();
      }

      if (collectedChars >= MAX_PDF_TEXT_CHARS) {
        break;
      }
    }

    let cleanedText = normalizeDocumentText(pageTexts.join('\n\n'));
    if (cleanedText.length > MAX_PDF_TEXT_CHARS) {
      cleanedText = cleanedText.slice(0, MAX_PDF_TEXT_CHARS).trimEnd();
    }

    if (!cleanedText || cleanedText.trim().length < MIN_PDF_TEXT_LENGTH) {
      const error = new Error(
        'This PDF has no selectable text (it appears to be an image-only or scanned document). Please upload a text-based PDF or paste the text directly instead.'
      );
      error.status = 400;
      throw error;
    }

    return {
      text: cleanedText,
      pages: totalPages,
      parsedPages: pageTexts.length,
    };
  } catch (err) {
    if (err?.status) {
      throw err;
    }
    if (err?.name === 'PasswordException' || /password/i.test(err?.message || '')) {
      const error = new Error(
        'This PDF is password-protected. Please remove the password and try again.'
      );
      error.status = 400;
      throw error;
    }
    if (
      err?.name === 'InvalidPDFException' ||
      err?.name === 'FormatError' ||
      /invalid pdf/i.test(err?.message || '')
    ) {
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
    if (pdf && typeof pdf.destroy === 'function') {
      await pdf.destroy().catch(() => {});
    }
  }
}
