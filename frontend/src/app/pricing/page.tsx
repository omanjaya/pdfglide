/**
 * Pricing Page
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

const plans = [
    {
        name: 'Free',
        price: '$0',
        period: 'forever',
        description: 'Perfect for occasional use',
        features: [
            '5 files per day',
            'Max 10MB per file',
            'All basic tools',
            'Standard processing',
        ],
        limitations: [
            'Contains ads',
            'No batch processing',
            'No API access',
        ],
        cta: 'Get Started',
        ctaLink: '/register',
        popular: false,
    },
    {
        name: 'Pro',
        price: '$9.99',
        period: 'per month',
        description: 'For professionals and teams',
        features: [
            'Unlimited files',
            'Max 100MB per file',
            'All tools + OCR',
            'Priority processing',
            'No ads',
            'Batch processing',
            'Email support',
        ],
        limitations: [],
        cta: 'Upgrade to Pro',
        ctaAction: 'checkout',
        priceId: 'price_pro_monthly',
        popular: true,
    },
    {
        name: 'Business',
        price: '$29.99',
        period: 'per month',
        description: 'For businesses and agencies',
        features: [
            'Everything in Pro',
            'Max 500MB per file',
            'API access',
            'Team accounts',
            'Priority support',
            'Custom branding',
            'SLA guarantee',
        ],
        limitations: [],
        cta: 'Contact Sales',
        ctaLink: 'mailto:sales@pdfglide.com',
        popular: false,
    },
];

export default function PricingPage() {
    const { isAuthenticated, tier } = useAuth();
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

    const handleCheckout = async (priceId: string) => {
        if (!isAuthenticated) {
            window.location.href = '/login?redirect=/pricing';
            return;
        }

        setIsLoading(priceId);

        try {
            const response = await fetch('/api/v1/stripe/create-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('pdfglide_access_token')}`,
                },
                body: JSON.stringify({
                    price_id: priceId,
                    success_url: `${window.location.origin}/profile?success=true`,
                    cancel_url: `${window.location.origin}/pricing`,
                }),
            });

            const data = await response.json();

            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            }
        } catch (error) {
            console.error('Checkout error:', error);
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            {/* Header */}
            <header className="py-6 px-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <span className="text-xl font-bold text-white">F</span>
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            PDFGlide
                        </span>
                    </Link>

                    {isAuthenticated ? (
                        <Link href="/profile" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600">
                            My Account
                        </Link>
                    ) : (
                        <Link href="/login" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600">
                            Sign In
                        </Link>
                    )}
                </div>
            </header>

            {/* Hero */}
            <section className="py-16 px-4 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                    Simple, transparent pricing
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                    Choose the plan that fits your needs. Upgrade or downgrade anytime.
                </p>

                {/* Billing Toggle */}
                <div className="mt-8 flex items-center justify-center gap-4">
                    <span className={`text-sm ${billingPeriod === 'monthly' ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                        Monthly
                    </span>
                    <button
                        onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
                        className="relative w-14 h-7 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors"
                    >
                        <div className={`absolute top-1 w-5 h-5 bg-indigo-600 rounded-full transition-transform ${billingPeriod === 'yearly' ? 'translate-x-8' : 'translate-x-1'
                            }`} />
                    </button>
                    <span className={`text-sm ${billingPeriod === 'yearly' ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                        Yearly
                        <span className="ml-1 text-green-500 font-medium">(-20%)</span>
                    </span>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="pb-24 px-4">
                <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden ${plan.popular ? 'ring-2 ring-indigo-500' : ''
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center text-sm font-medium py-1">
                                    Most Popular
                                </div>
                            )}

                            <div className={`p-8 ${plan.popular ? 'pt-12' : ''}`}>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {plan.name}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                    {plan.description}
                                </p>

                                <div className="mt-6 flex items-baseline">
                                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                                        {billingPeriod === 'yearly' && plan.price !== '$0'
                                            ? `$${(parseFloat(plan.price.slice(1)) * 0.8 * 12).toFixed(0)}`
                                            : plan.price}
                                    </span>
                                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                                        /{billingPeriod === 'yearly' && plan.price !== '$0' ? 'year' : plan.period}
                                    </span>
                                </div>

                                {/* CTA Button */}
                                {plan.ctaAction === 'checkout' ? (
                                    <button
                                        onClick={() => handleCheckout(plan.priceId!)}
                                        disabled={isLoading === plan.priceId || tier === plan.name.toLowerCase()}
                                        className={`mt-6 w-full py-3 px-4 rounded-xl font-semibold transition-all ${tier === plan.name.toLowerCase()
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : plan.popular
                                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white hover:bg-gray-200'
                                            }`}
                                    >
                                        {tier === plan.name.toLowerCase()
                                            ? 'Current Plan'
                                            : isLoading === plan.priceId
                                                ? 'Loading...'
                                                : plan.cta}
                                    </button>
                                ) : (
                                    <Link
                                        href={plan.ctaLink!}
                                        className={`mt-6 w-full py-3 px-4 rounded-xl font-semibold transition-all block text-center ${tier === plan.name.toLowerCase()
                                                ? 'bg-gray-300 text-gray-500 pointer-events-none'
                                                : plan.popular
                                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white hover:bg-gray-200'
                                            }`}
                                    >
                                        {tier === plan.name.toLowerCase() ? 'Current Plan' : plan.cta}
                                    </Link>
                                )}

                                {/* Features */}
                                <ul className="mt-8 space-y-3">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                                        </li>
                                    ))}
                                    {plan.limitations.map((limitation) => (
                                        <li key={limitation} className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-gray-500">{limitation}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* FAQ */}
            <section className="py-16 px-4 bg-white dark:bg-gray-800">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
                        Frequently Asked Questions
                    </h2>

                    <div className="space-y-6">
                        {[
                            {
                                q: 'Can I cancel anytime?',
                                a: 'Yes, you can cancel your subscription at any time. You\'ll continue to have access until the end of your billing period.',
                            },
                            {
                                q: 'What payment methods do you accept?',
                                a: 'We accept all major credit cards (Visa, Mastercard, American Express) and PayPal.',
                            },
                            {
                                q: 'Is there a free trial?',
                                a: 'Our Free plan lets you try all basic features forever. No credit card required!',
                            },
                            {
                                q: 'Can I switch plans?',
                                a: 'Yes, you can upgrade or downgrade at any time. Changes take effect immediately.',
                            },
                        ].map((faq) => (
                            <div key={faq.q} className="border-b border-gray-200 dark:border-gray-700 pb-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    {faq.q}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
