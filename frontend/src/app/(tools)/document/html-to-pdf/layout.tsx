import { generateToolMetadata, generateToolSchema } from '@/lib/seo';
import Script from 'next/script';

export const metadata = generateToolMetadata('document/html-to-pdf');

export default function Layout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema('document/html-to-pdf');
  return (
    <>
      {toolSchema && (
        <Script
          id="tool-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }}
        />
      )}
      {children}
    </>
  );
}
