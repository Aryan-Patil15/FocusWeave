"use client";

import { useEffect, useState } from 'react';
import { ExternalLink, Plus, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getQuickLinksPreference, setQuickLinksPreference, type QuickLinkItem } from '@/lib/user-preferences';
import { useAuth } from '@/hooks/use-auth';
import { loadUserSettingsFromDb, saveUserSettingsToDb } from '@/lib/user-settings-db';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function QuickLinksWidget() {
  const { user } = useAuth();
  const [links, setLinks] = useState<QuickLinkItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadLinks() {
      const localLinks = getQuickLinksPreference();
      if (isActive) {
        setLinks(localLinks);
      }

      if (!user?.uid) {
        return;
      }

      const dbSettings = await loadUserSettingsFromDb(user.uid);
      if (!isActive) {
        return;
      }

      if (dbSettings.quickLinks && dbSettings.quickLinks.length >= 0) {
        setLinks(dbSettings.quickLinks);
        setQuickLinksPreference(dbSettings.quickLinks); // Sync local state with DB
      }
    }

    loadLinks();

    return () => {
      isActive = false;
    };
  }, [user?.uid]);

  const handleAddLink = async () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    
    let formattedUrl = newUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const newLink: QuickLinkItem = {
      id: Date.now().toString(),
      label: newLabel.trim(),
      url: formattedUrl,
    };

    const updatedLinks = [...links, newLink];
    setLinks(updatedLinks);
    setQuickLinksPreference(updatedLinks);

    if (user?.uid) {
      await saveUserSettingsToDb(user.uid, { quickLinks: updatedLinks });
    }

    setNewLabel('');
    setNewUrl('');
    setIsDialogOpen(false);
  };

  const handleRemoveLink = async (idToRemove: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const updatedLinks = links.filter((link) => link.id !== idToRemove);
    setLinks(updatedLinks);
    setQuickLinksPreference(updatedLinks);

    if (user?.uid) {
      await saveUserSettingsToDb(user.uid, { quickLinks: updatedLinks });
    }
  };

  return (
    <Card className="h-full border-border/80 shadow-sm flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl">Quick Launch</CardTitle>
          <CardDescription>Open your most-used tools</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
              <span className="sr-only">Add Link</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Quick Link</DialogTitle>
              <DialogDescription>
                Add a new website to your quick launch pad.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="label" className="text-right">
                  Name
                </Label>
                <Input
                  id="label"
                  placeholder="e.g. GitHub"
                  className="col-span-3"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="url" className="text-right">
                  URL
                </Label>
                <Input
                  id="url"
                  placeholder="e.g. https://github.com"
                  className="col-span-3"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddLink();
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleAddLink}>Save Link</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="pt-4 flex-grow">
        {links.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {links.map((link) => (
              <div key={link.id} className="relative group">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary pr-10"
                >
                  <span className="truncate">{link.label}</span>
                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                </a>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                  onClick={(e) => handleRemoveLink(link.id, e)}
                  title="Remove link"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">No quick links configured.</p>
            <Button variant="link" size="sm" onClick={() => setIsDialogOpen(true)} className="h-auto p-0">
              Add your first link
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
