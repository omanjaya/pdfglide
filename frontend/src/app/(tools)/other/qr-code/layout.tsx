import { generateToolMetadata, generateToolSchema } from '@/lib/seo';
import Script from 'next/script';

export const metadata = generateToolMetadata('other/qr-code');

export default function Layout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema('other/qr-code');
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
