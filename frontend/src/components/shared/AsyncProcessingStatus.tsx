'use client';

/**
 * AsyncProcessingStatus - Enhanced processing status component for async tasks.
 * 
 * This component integrates with the useTaskPolling hook to show real-time
 * progress updates for background processing tasks.
 */

import { useEffect } from 'react';
import { CheckCircle2, Loader2, XCircle, Download, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { formatFileSize } from '@/lib/utils';
import { getDownloadUrl, cancelTask } from '@/lib/api';
import { useTaskPolling, TaskStatus, TaskState } from '@/hooks/useTaskPolling';

interface AsyncProcessingStatusProps {
    /** Task ID to poll for status */
    taskId: string | null;
    /** Called when processing completes successfully */
    onComplete?: (state: TaskState) => void;
    /** Called when processing fails */
    onError?: (error: string) => void;
    /** Called when user wants to reset/start over */
    onReset?: () => void;
    /** Custom polling interval in ms (default: 1000) */
    pollInterval?: number;
}

const statusConfig: Record<TaskStatus, { icon: React.ReactNode; label: string; color: string }> = {
    idle: {
        icon: null,
        label: '',
        color: '',
    },
    pending: {
        icon: <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500 animate-pulse" />,
        label: 'Waiting to start...',
        color: 'text-amber-500',
    },
    queued: {
        icon: <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500 animate-pulse" />,
        label: 'Queued for processing...',
        color: 'text-amber-500',
    },
    processing: {
        icon: <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-spin" />,
        label: 'Processing...',
        color: 'text-primary',
    },
    completed: {
        icon: <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />,
        label: 'Processing complete!',
        color: 'text-green-500',
    },
    failed: {
        icon: <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />,
        label: 'Processing failed',
        color: 'text-destructive',
    },
    cancelled: {
        icon: <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />,
        label: 'Processing cancelled',
        color: 'text-muted-foreground',
    },
};

export function AsyncProcessingStatus({
    taskId,
    onComplete,
    onError,
    onReset,
    pollInterval = 1000,
}: AsyncProcessingStatusProps) {
    const { state, startPolling, stopPolling, reset, isPolling } = useTaskPolling({
        pollInterval,
        onComplete,
        onError: (error) => onError?.(error),
    });

    // Start polling when taskId changes
    useEffect(() => {
        if (taskId) {
            startPolling(taskId);
        }
        return () => {
            stopPolling();
        };
    }, [taskId, startPolling, stopPolling]);

    // Handle cancel
    const handleCancel = async () => {
        if (state.taskId && (state.status === 'pending' || state.status === 'queued')) {
            try {
                await cancelTask(state.taskId);
                stopPolling();
                reset();
                onReset?.();
            } catch (error) {
                console.error('Failed to cancel task:', error);
            }
        }
    };

    // Handle retry (for failed tasks)
    const handleRetry = () => {
        reset();
        onReset?.();
    };

    // Don't render if idle
    if (state.status === 'idle' || !taskId) {
        return null;
    }

    const config = statusConfig[state.status];

    return (
        <div className="rounded-lg border bg-card p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
                {/* Status header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                        {config.icon}
                        <span className={`text-sm sm:text-base font-medium ${config.color}`}>
                            {config.label}
                        </span>
                    </div>

                    {/* Cancel button for pending/queued tasks */}
                    {(state.status === 'pending' || state.status === 'queued') && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancel}
                            className="text-muted-foreground hover:text-destructive"
                        >
                            Cancel
                        </Button>
                    )}
                </div>

                {/* Progress bar for processing state */}
                {state.status === 'processing' && state.progress > 0 && (
                    <div className="space-y-2">
                        <Progress value={state.progress} />
                        <p className="text-xs sm:text-sm text-muted-foreground text-center">
                            {state.progress}% complete
                        </p>
                    </div>
                )}

                {/* Indeterminate progress for queued/pending */}
                {(state.status === 'queued' || state.status === 'pending') && (
                    <div className="space-y-2">
                        <Progress value={undefined} className="animate-pulse" />
                        <p className="text-xs sm:text-sm text-muted-foreground text-center">
                            Your file is in the queue...
                        </p>
                    </div>
                )}

                {/* Processing message */}
                {state.status === 'processing' && state.progress === 0 && (
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Please wait while we process your file
                    </p>
                )}

                {/* Completed state */}
                {state.status === 'completed' && (
                    <>
                        {state.fileName && (
                            <div className="rounded-lg bg-muted p-3 sm:p-4">
                                <p className="text-sm sm:text-base font-medium truncate">{state.fileName}</p>
                                {state.fileSize && (
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                        {formatFileSize(state.fileSize)}
                                    </p>
                                )}
                            </div>
                        )}
                        <div className="flex flex-col xs:flex-row gap-2">
                            {state.downloadUrl && (
                                <Button asChild className="w-full xs:w-auto">
                                    <a href={getDownloadUrl(state.downloadUrl)} download>
                                        <Download className="mr-2 h-4 w-4" />
                                        Download
                                    </a>
                                </Button>
                            )}
                            {onReset && (
                                <Button variant="outline" onClick={handleRetry} className="w-full xs:w-auto">
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    <span className="hidden sm:inline">Process another file</span>
                                    <span className="sm:hidden">New file</span>
                                </Button>
                            )}
                        </div>
                    </>
                )}

                {/* Failed/Cancelled state */}
                {(state.status === 'failed' || state.status === 'cancelled') && (
                    <>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            {state.error || 'An error occurred while processing your file'}
                        </p>
                        <div className="flex flex-col xs:flex-row gap-2">
                            <Button onClick={handleRetry} className="w-full xs:w-auto">
                                Try again
                            </Button>
                            {onReset && (
                                <Button variant="outline" onClick={handleRetry} className="w-full xs:w-auto">
                                    Start over
                                </Button>
                            )}
                        </div>
                    </>
                )}

                {/* Task ID for debugging */}
                {state.taskId && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground/50 font-mono">
                        Task ID: {state.taskId}
                    </p>
                )}
            </div>
        </div>
    );
}

export default AsyncProcessingStatus;
