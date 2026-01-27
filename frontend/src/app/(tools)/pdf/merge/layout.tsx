import { generateToolMetadata, generateToolSchema } from '@/lib/seo';
import Script from 'next/script';

export const metadata = generateToolMetadata('pdf/merge');

export default function MergePdfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const toolSchema = generateToolSchema('pdf/merge');

  return (
    <>
      {toolSchema && (
        <Script
          id="tool-schema-merge"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }}
        />
      )}
      {children}
    </>
  );
}
