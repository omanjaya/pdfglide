'use client';

import { useState } from 'react';
import { QrCode, Download } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { Button } from '@/components/ui/Button';
import { api, getDownloadUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'generating' | 'completed' | 'error';

const sizeOptions = [
  { value: 200, label: 'Small', description: '200x200px' },
  { value: 400, label: 'Medium', description: '400x400px' },
  { value: 800, label: 'Large', description: '800x800px' },
];

export default function QRCodePage() {
  const [content, setContent] = useState('');
  const [size, setSize] = useState(400);
  const [status, setStatus] = useState<Status>('idle');
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!content.trim()) return;

    setStatus('generating');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('size', size.toString());

      const response = await api.post('/qr/generate', formData);

      if (response.data.success) {
        const url = getDownloadUrl(response.data.data.download_url);
        setQrImageUrl(url);
        setDownloadUrl(response.data.data.download_url);
        setStatus('completed');
      } else {
        setError(response.data.error || 'Generation failed');
        setStatus('error');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setContent('');
    setSize(400);
    setStatus('idle');
    setQrImageUrl(null);
    setDownloadUrl(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="QR Code Generator"
      description="Create QR codes from text, URLs, or any content"
      icon={QrCode}
      color="bg-purple-500"
    >
      <div className="space-y-6">
        {status !== 'completed' && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter text, URL, or any content..."
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Size</label>
              <div className="grid grid-cols-3 gap-2">
                {sizeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSize(option.value)}
                    className={cn(
                      'rounded-lg border p-3 text-center transition-colors',
                      size === option.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={!content.trim() || status === 'generating'}
              >
                {status === 'generating' ? (
                  <>
                    <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-5 w-5" />
                    Generate QR Code
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {status === 'completed' && qrImageUrl && (
          <div className="space-y-6 text-center">
            <div className="inline-block rounded-lg border bg-white p-4">
              <img
                src={qrImageUrl}
                alt="Generated QR Code"
                className="mx-auto"
                style={{ width: size / 2, height: size / 2 }}
              />
            </div>

            <div className="flex justify-center gap-2">
              {downloadUrl && (
                <Button asChild>
                  <a href={getDownloadUrl(downloadUrl)} download="qrcode.png">
                    <Download className="mr-2 h-4 w-4" />
                    Download PNG
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={handleReset}>
                Generate another
              </Button>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
