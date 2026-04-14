"use client";

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SearchEngineKey = 'google' | 'youtube' | 'quora' | 'reddit';

const SEARCH_ENGINES: Record<SearchEngineKey, { label: string; baseUrl: string }> = {
  google: {
    label: 'Google',
    baseUrl: 'https://www.google.com/search?q=',
  },
  youtube: {
    label: 'YouTube',
    baseUrl: 'https://www.youtube.com/results?search_query=',
  },
  quora: {
    label: 'Quora',
    baseUrl: 'https://www.quora.com/search?q=',
  },
  reddit: {
    label: 'Reddit',
    baseUrl: 'https://www.reddit.com/search/?q=',
  },
};

export function DirectSearchWidget() {
  const [engine, setEngine] = useState<SearchEngineKey>('google');
  const [query, setQuery] = useState('');

  const placeholder = useMemo(
    () => `Search on ${SEARCH_ENGINES[engine].label}...`,
    [engine]
  );

  const runSearch = () => {
    const normalized = query.trim();
    if (!normalized) {
      return;
    }

    const baseUrl = SEARCH_ENGINES[engine].baseUrl;
    let url = '';
    
    // Construct URL properly
    url = `${baseUrl}${encodeURIComponent(normalized)}`;
    
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  };

  return (
    <Card className="h-full border-border/80 shadow-sm" onPointerDown={(e) => e.stopPropagation()}>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Search className="h-5 w-5 text-primary" />
          Direct Search
        </CardTitle>
        <CardDescription>Search Google, YouTube, Quora, or Reddit directly from FocusWeave</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Select value={engine} onValueChange={(value) => setEngine(value as SearchEngineKey)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a search engine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="quora">Quora</SelectItem>
              <SelectItem value="reddit">Reddit</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
            />
            <Button onClick={runSearch} disabled={!query.trim()}>
              Search
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
