'use client';

import { useEffect } from 'react';

interface AdBannerProps {
  slot: string;
  className?: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
}

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const ADSENSE_ENABLED = !!ADSENSE_CLIENT_ID && !ADSENSE_CLIENT_ID.includes('XXXX');

export function AdBanner({ slot, className = '', format = 'auto' }: AdBannerProps) {
  useEffect(() => {
    if (!ADSENSE_ENABLED) return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.log('AdSense error:', err);
    }
  }, []);

  // Don't show ads in development or without valid client ID
  if (process.env.NODE_ENV === 'development' || !ADSENSE_ENABLED) {
    return null;
  }

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
