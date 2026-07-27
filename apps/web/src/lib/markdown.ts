/**
 * A tiny, dependency-free Markdown renderer.
 *
 * Safety first: the raw input is HTML-escaped up front, so no user-authored
 * markup (e.g. <script>) can ever reach the DOM. Only a fixed set of Markdown
 * constructs are then re-introduced as known-safe tags. Links are restricted to
 * http(s). This is deliberately not a full CommonMark implementation — it
 * covers the common cases a knowledge base needs.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(text: string): string {
  let t = text;
  // inline code
  t = t.replace(/`([^`]+)`/g, '<code class="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">$1</code>');
  // bold then italic
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  // links [text](http(s)://...)
  t = t.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" class="text-[var(--color-accent-soft)] underline">$1</a>',
  );
  return t;
}

export function renderMarkdown(md: string): string {
  const escaped = escapeHtml(md ?? '');
  const lines = escaped.split('\n');
  const out: string[] = [];

  let inCode = false;
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw;

    // fenced code blocks
    if (/^```/.test(line.trim())) {
      if (inCode) {
        out.push('</code></pre>');
        inCode = false;
      } else {
        closeList();
        out.push('<pre class="my-2 overflow-auto rounded-lg bg-black/50 p-3 text-xs"><code>');
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(line + '\n');
      continue;
    }

    if (line.trim() === '') {
      closeList();
      continue;
    }

    // horizontal rule
    if (/^---+\s*$/.test(line)) {
      closeList();
      out.push('<hr class="my-4 border-white/10" />');
      continue;
    }

    // headings
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      const level = h[1].length;
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base'];
      out.push(
        `<h${level} class="mt-4 mb-2 font-semibold ${sizes[level - 1]}">${inline(h[2])}</h${level}>`,
      );
      continue;
    }

    // blockquote
    const bq = /^>\s?(.*)$/.exec(line);
    if (bq) {
      closeList();
      out.push(
        `<blockquote class="my-2 border-l-2 border-white/20 pl-3 text-white/60">${inline(bq[1])}</blockquote>`,
      );
      continue;
    }

    // task list item
    const task = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (task) {
      if (listType !== 'ul') {
        closeList();
        out.push('<ul class="my-2 space-y-1">');
        listType = 'ul';
      }
      const checked = task[1].toLowerCase() === 'x';
      out.push(
        `<li class="flex items-start gap-2"><input type="checkbox" disabled ${checked ? 'checked' : ''} class="mt-1" /><span>${inline(task[2])}</span></li>`,
      );
      continue;
    }

    // unordered list item
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        out.push('<ul class="my-2 list-disc space-y-1 pl-6">');
        listType = 'ul';
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    // ordered list item
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      if (listType !== 'ol') {
        closeList();
        out.push('<ol class="my-2 list-decimal space-y-1 pl-6">');
        listType = 'ol';
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    // paragraph
    closeList();
    out.push(`<p class="my-2 leading-relaxed">${inline(line)}</p>`);
  }

  if (inCode) out.push('</code></pre>');
  closeList();
  return out.join('\n');
}
