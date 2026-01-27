/**
 * Google AdSense Ad Banner Component
 * Shows ads only for free tier users
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { useUserLimits } from '@/hooks/useAuth';

// AdSense client ID from environment
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '';

interface AdBannerProps {
    slot: string;
    format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
    style?: React.CSSProperties;
    className?: string;
}

export function AdBanner({
    slot,
    format = 'auto',
    style,
    className = '',
}: AdBannerProps) {
    const { showAds, tier } = useUserLimits();
    const adRef = useRef<HTMLModElement>(null);
    const initialized = useRef(false);

    useEffect(() => {
        // Don't show ads if user is Pro/Business or AdSense not configured
        if (!showAds || !ADSENSE_CLIENT || !slot) {
            return;
        }

        // Prevent double initialization
        if (initialized.current) {
            return;
        }

        try {
            // Initialize AdSense
            if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
                initialized.current = true;
            }
        } catch (error) {
            console.error('AdSense error:', error);
        }
    }, [showAds, slot]);

    // Don't render anything for premium users
    if (!showAds) {
        return null;
    }

    // Don't render if AdSense not configured
    if (!ADSENSE_CLIENT) {
        // Show placeholder in development
        if (process.env.NODE_ENV === 'development') {
            return (
                <div
                    className={`bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 text-sm ${className}`}
                    style={{ minHeight: '90px', ...style }}
                >
                    <span>Ad Placeholder (Free tier only)</span>
                </div>
            );
        }
        return null;
    }

    return (
        <div className={`ad-container ${className}`}>
            <ins
                ref={adRef}
                className="adsbygoogle"
                style={{
                    display: 'block',
                    ...style,
                }}
                data-ad-client={ADSENSE_CLIENT}
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive="true"
            />
        </div>
    );
}

// Pre-built ad placements
export function HeaderAd() {
    return (
        <AdBanner
            slot="header-ad-slot"
            format="horizontal"
            className="my-4"
            style={{ minHeight: '90px' }}
        />
    );
}

export function SidebarAd() {
    return (
        <AdBanner
            slot="sidebar-ad-slot"
            format="rectangle"
            className="mb-4"
            style={{ minHeight: '250px' }}
        />
    );
}

export function AfterProcessAd() {
    return (
        <AdBanner
            slot="after-process-ad-slot"
            format="horizontal"
            className="my-6"
            style={{ minHeight: '90px' }}
        />
    );
}

export function FooterAd() {
    return (
        <AdBanner
            slot="footer-ad-slot"
            format="horizontal"
            className="my-4"
            style={{ minHeight: '90px' }}
        />
    );
}

export default AdBanner;
