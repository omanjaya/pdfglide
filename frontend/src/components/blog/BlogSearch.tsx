'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

export function BlogSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/blog?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push('/blog');
    }
  };

  const handleClear = () => {
    setQuery('');
    router.push('/blog');
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <div
        className={`relative flex items-center transition-all duration-300 ${
          isFocused
            ? 'ring-2 ring-white/40 bg-white/20'
            : 'bg-white/10 hover:bg-white/15'
        } rounded-xl border border-white/20`}
      >
        <Search className="absolute left-4 w-5 h-5 text-blue-200" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Cari artikel, tutorial, atau tips..."
          className="w-full px-12 py-3.5 bg-transparent text-white placeholder-blue-200/70 focus:outline-none"
          aria-label="Cari artikel blog"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-14 p-1 text-blue-200 hover:text-white transition-colors"
            aria-label="Hapus pencarian"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          className="absolute right-2 p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
          aria-label="Cari"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
