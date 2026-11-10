'use client';

import Script from 'next/script';

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export function AdSenseScript() {
  // Don't load AdSense in development or when no valid client ID is configured
  if (process.env.NODE_ENV === 'development') {
    return null;
  }
  if (!ADSENSE_CLIENT_ID || ADSENSE_CLIENT_ID.includes('XXXX')) {
    return null;
  }

  return (
    <Script
      id="adsense-script"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
