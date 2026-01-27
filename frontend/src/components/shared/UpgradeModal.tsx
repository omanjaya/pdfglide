/**
 * Upgrade Modal - Shows when user hits free tier limits
 */

'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    reason?: 'file_limit' | 'size_limit' | 'feature';
    details?: {
        maxSize?: number;
        fileSize?: number;
        dailyLimit?: number;
        used?: number;
    };
}

export function UpgradeModal({ isOpen, onClose, reason = 'file_limit', details }: UpgradeModalProps) {
    const { isAuthenticated, tier } = useAuth();

    if (!isOpen) return null;

    const getMessage = () => {
        switch (reason) {
            case 'size_limit':
                return {
                    title: 'File Too Large',
                    description: details?.maxSize
                        ? `Your file (${(details.fileSize! / 1024 / 1024).toFixed(1)}MB) exceeds the ${(details.maxSize / 1024 / 1024).toFixed(0)}MB limit.`
                        : 'This file exceeds your current size limit.',
                    action: isAuthenticated && tier === 'free'
                        ? 'Upgrade to Pro for files up to 100MB!'
                        : 'Create a free account for larger file limits!',
                };
            case 'file_limit':
                return {
                    title: 'Daily Limit Reached',
                    description: details?.dailyLimit
                        ? `You've used ${details.used} of ${details.dailyLimit} files today.`
                        : 'You\'ve reached your daily file limit.',
                    action: isAuthenticated && tier === 'free'
                        ? 'Upgrade to Pro for unlimited files!'
                        : 'Create a free account for more files!',
                };
            case 'feature':
                return {
                    title: 'Pro Feature',
                    description: 'This feature requires a Pro subscription.',
                    action: 'Upgrade to unlock all features!',
                };
            default:
                return {
                    title: 'Upgrade Required',
                    description: 'This action requires an upgraded account.',
                    action: 'Upgrade now!',
                };
        }
    };

    const message = getMessage();

    const plans = [
        {
            name: 'Free',
            price: '$0',
            period: '/forever',
            features: ['5 files/day', 'Max 10MB files', 'Basic tools'],
            current: tier === 'free',
        },
        {
            name: 'Pro',
            price: '$9.99',
            period: '/month',
            features: ['Unlimited files', 'Max 100MB files', 'No ads', 'Priority processing', 'Batch upload'],
            recommended: true,
        },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 text-white">
                    <h2 className="text-2xl font-bold">{message.title}</h2>
                    <p className="text-indigo-100 mt-1">{message.description}</p>
                </div>

                {/* Content */}
                <div className="p-8">
                    <p className="text-center text-lg text-gray-700 dark:text-gray-300 mb-8">
                        {message.action}
                    </p>

                    {/* Plans */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {plans.map((plan) => (
                            <div
                                key={plan.name}
                                className={`relative rounded-xl border-2 p-6 transition-all ${plan.recommended
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                                        : 'border-gray-200 dark:border-gray-700'
                                    } ${plan.current ? 'opacity-50' : ''}`}
                            >
                                {plan.recommended && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                                        RECOMMENDED
                                    </span>
                                )}

                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {plan.name}
                                </h3>

                                <div className="mt-2 flex items-baseline">
                                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                                        {plan.price}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                                        {plan.period}
                                    </span>
                                </div>

                                <ul className="mt-4 space-y-2">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-center text-gray-600 dark:text-gray-300">
                                            <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    className={`mt-6 w-full py-3 px-4 rounded-lg font-semibold transition-colors ${plan.current
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : plan.recommended
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-white'
                                        }`}
                                    disabled={plan.current}
                                >
                                    {plan.current ? 'Current Plan' : plan.recommended ? 'Upgrade Now' : 'Get Started'}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    {!isAuthenticated && (
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
                            Already have an account?{' '}
                            <a href="/login" className="text-indigo-600 hover:underline">
                                Sign in
                            </a>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default UpgradeModal;
