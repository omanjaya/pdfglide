'use client';

interface MarkdownContentProps {
  content: string;
}

// Simple markdown to HTML converter
function parseMarkdown(markdown: string): string {
  let html = markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline">$1</a>')
    // Unordered lists
    .replace(/^\- (.*)$/gim, '<li class="ml-4">$1</li>')
    // Code blocks
    .replace(/```([^`]+)```/g, '<pre class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-x-auto my-4"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">$1</code>')
    // Tables
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(cell => cell.trim());
      if (cells.every(cell => cell.trim().match(/^[-:]+$/))) {
        return ''; // Skip separator row
      }
      const isHeader = cells.some(cell => cell.includes('---'));
      if (isHeader) return '';
      const cellHtml = cells.map(cell => `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2">${cell.trim()}</td>`).join('');
      return `<tr>${cellHtml}</tr>`;
    })
    // Horizontal rule
    .replace(/^---$/gim, '<hr class="my-6 border-gray-300 dark:border-gray-600" />')
    // Paragraphs - wrap text blocks
    .replace(/\n\n/g, '</p><p class="my-4">')
    // Line breaks
    .replace(/\n/g, '<br />');

  // Wrap lists
  html = html.replace(/(<li[^>]*>.*<\/li>\s*)+/g, '<ul class="list-disc pl-6 my-4">$&</ul>');

  // Wrap tables
  html = html.replace(/(<tr>.*<\/tr>\s*)+/g, '<table class="w-full border-collapse my-4">$&</table>');

  return `<div class="prose-content"><p class="my-4">${html}</p></div>`;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const html = parseMarkdown(content);

  return (
    <div
      className="prose prose-lg dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
