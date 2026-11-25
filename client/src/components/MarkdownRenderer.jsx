import React from 'react';

function renderInline(text) {
  const parts = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|"[^"\n]{8,}")/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-indigo-700"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('"') && token.endsWith('"')) {
      parts.push(
        <span
          key={match.index}
          className="rounded bg-amber-50 px-1 py-0.5 text-amber-950 ring-1 ring-amber-200/80"
        >
          {token}
        </span>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export default function MarkdownRenderer({ content }) {
  const lines = String(content || '').split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Blockquotes (great for cited document excerpts)
    if (trimmed.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-2 border-l-4 border-indigo-400 bg-indigo-50/60 px-3 py-2 text-sm text-slate-700 italic rounded-r-lg"
        >
          {renderInline(quoteLines.join(' '))}
        </blockquote>
      );
      continue;
    }

    // Bullet lists
    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-4 list-disc marker:text-indigo-500">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm leading-relaxed text-slate-700">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered lists
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1.5 pl-4 list-decimal marker:text-indigo-600 marker:font-medium">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm leading-relaxed text-slate-700">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Headings
    if (/^#{1,3}\s+/.test(trimmed)) {
      const headingText = trimmed.replace(/^#{1,3}\s+/, '');
      elements.push(
        <h4 key={`h-${i}`} className="mt-2.5 mb-1 text-sm font-semibold text-slate-900">
          {renderInline(headingText)}
        </h4>
      );
      i += 1;
      continue;
    }

    // Regular paragraph
    const paraLines = [trimmed];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('>') &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^#{1,3}\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }

    elements.push(
      <p key={`p-${i}`} className="my-1.5 text-sm leading-relaxed text-slate-700 first:mt-0 last:mb-0">
        {renderInline(paraLines.join(' '))}
      </p>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}
