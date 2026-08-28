import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(source) {
  if (!source || !source.trim()) return '';
  return marked.parse(source.trim());
}
