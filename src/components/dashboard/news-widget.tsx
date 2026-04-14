"use client";

import { useEffect, useState } from 'react';
import { ExternalLink, Globe2, Plus, X, Settings2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconSpinner } from '@/components/icons';
import { handleFetchTopNews, type TopNewsResult } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CATEGORIES_CACHE_KEY = 'focusweave.newsCategories';
const NEWS_CACHE_TTL_MS = 3 * 60 * 1000;
const DEFAULT_CATEGORIES = ['technology', 'business', 'startups', 'productivity'];

type CachedNews = {
  data: TopNewsResult;
  fetchedAt: number;
};

export function NewsWidget() {
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState<string>('technology');
  
  const [data, setData] = useState<TopNewsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Manage Categories State
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CATEGORIES_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
          setActiveCategory(parsed[0]);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadNews() {
      setIsLoading(true);
      const cacheKey = `focusweave.news.${activeCategory}`;

      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as CachedNews;
          const isFresh = Date.now() - cached.fetchedAt < NEWS_CACHE_TTL_MS;
          if (isFresh && cached.data?.items?.length > 0) {
            if (isActive) {
              setData(cached.data);
              setIsLoading(false);
            }
            return;
          }
        }
      } catch (error) {
        console.warn('Could not read cached news:', error);
      }

      const result = await handleFetchTopNews(activeCategory);
      if (!isActive) return;

      setData(result);
      try {
        const payload: CachedNews = {
          data: result,
          fetchedAt: Date.now(),
        };
        localStorage.setItem(cacheKey, JSON.stringify(payload));
      } catch (error) {
        console.warn('Could not cache news:', error);
      }
      setIsLoading(false);
    }

    loadNews();

    return () => {
      isActive = false;
    };
  }, [activeCategory]);

  const handleAddCategory = () => {
    const cleanCat = newCategory.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (!cleanCat || categories.includes(cleanCat)) return;

    const newCategories = [...categories, cleanCat];
    setCategories(newCategories);
    localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(newCategories));
    setNewCategory('');
  };

  const handleRemoveCategory = (catToRemove: string) => {
    const newCategories = categories.filter(c => c !== catToRemove);
    if (newCategories.length === 0) {
      newCategories.push('worldnews'); // Fallback so there's always one
    }
    setCategories(newCategories);
    localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(newCategories));
    
    if (activeCategory === catToRemove) {
      setActiveCategory(newCategories[0]);
    }
  };

  return (
    <Card className="h-full border-border/80 shadow-sm flex flex-col">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Globe2 className="h-5 w-5 text-primary" />
            Top News
          </CardTitle>
          <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground bg-secondary/50">
                <Settings2 className="h-4 w-4" />
                <span className="sr-only">Manage Categories</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>News Categories</DialogTitle>
                <DialogDescription>
                  Manage the categories used to fetch your news. Enter topics without spaces.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2 space-y-4">
                <div className="flex items-center gap-2">
                  <Input 
                    placeholder="e.g. artificial" 
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  />
                  <Button onClick={handleAddCategory} size="sm">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 max-h-[200px] overflow-y-auto pr-1">
                  {categories.map((cat) => (
                    <div key={cat} className="flex items-center gap-1 bg-secondary rounded-full px-3 py-1 text-sm border">
                      <span className="capitalize">{cat}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCategory(cat)}
                        className="h-5 w-5 rounded-full hover:bg-destructive/20 hover:text-destructive ml-1"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Scrolling categories bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
          {categories.map(cat => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'default' : 'secondary'}
              size="sm"
              className="h-7 text-xs rounded-full snap-start shrink-0 capitalize"
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-grow">
        {isLoading ? (
          <div className="flex h-[150px] items-center justify-center">
            <IconSpinner className="h-8 w-8 text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {data?.items.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:bg-secondary/50"
              >
                <span className="line-clamp-2 text-sm text-foreground group-hover:text-primary">{item.title}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  Open story <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </a>
            ))}
            {(!data?.items || data.items.length === 0) && (
              <p className="text-sm text-muted-foreground py-4 text-center">No news found for this category.</p>
            )}
            <p className="pt-1 text-xs text-muted-foreground mt-auto">Source: {data?.source}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
