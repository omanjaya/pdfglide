import { generateToolMetadata, generateToolSchema } from '@/lib/seo';
import Script from 'next/script';

export const metadata = generateToolMetadata('pdf/compress');

export default function Layout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema('pdf/compress');
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
