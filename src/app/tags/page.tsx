// Summary: Page for managing user-created Tags (CRUD).
// TODO: Implement a proper color picker input instead of text for color.
// TODO: Add edit functionality for existing tags (name, color).
// TODO: Consider pagination for tag list if it can grow very large.

'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Tag as TagIcon, Trash2, Palette, Edit, Loader2, AlertTriangle } from 'lucide-react'; // Added Edit icon
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; // Added CardDescription
import { ScrollArea } from '@/components/ui/scroll-area';

interface TagData {
  id: string;
  name: string;
  color: string | null;
  habitCount?: number; // From analytics endpoint
  questCount?: number; // From analytics endpoint
}

const TagManagerPage = () => {
  const [tagsWithCounts, setTagsWithCounts] = useState<TagData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for "Create New Tag" modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  // State for "Edit Tag" modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<TagData | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [isEditingTag, setIsEditingTag] = useState(false);


  const fetchTagsAndCounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetching from /api/analytics/tags which includes counts
      const response = await fetch('/api/analytics/tags');
      if (!response.ok) {
        const errData = await response.json();
         if (response.status === 501 && errData.error?.includes("Tag feature might not be fully set up")) {
            throw new Error("Tag system not fully configured in the backend. Required tables may be missing.");
          }
        throw new Error(errData.error || 'Failed to fetch tags with counts.');
      }
      const data: TagData[] = await response.json();
      setTagsWithCounts(data);
    } catch (err: any) {
      setError(err.message);
      // toast.error(err.message); // Toast shown by individual components or on specific actions
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTagsAndCounts();
  }, [fetchTagsAndCounts]);

  const handleCreateTagSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) {
      toast.error('Tag name is required.');
      return;
    }
    // Basic hex color validation (optional, can be stricter)
    if (newTagColor && !/^#([0-9A-Fa-f]{3}){1,2}$/i.test(newTagColor)) {
        toast.error('Invalid hex color format (e.g., #RRGGBB or #RGB). Leave empty for default.');
        return;
    }

    setIsCreatingTag(true);
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor.trim() || null }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create tag.');
      }
      toast.success('Tag created successfully!');
      setNewTagName('');
      setNewTagColor('');
      setIsCreateModalOpen(false);
      fetchTagsAndCounts(); // Refresh tag list
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!window.confirm(`Are you sure you want to delete the tag "${tagName}"? This will remove it from all associated habits and quests.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/tags/${tagId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete tag.');
      }
      toast.success(`Tag "${tagName}" deleted.`);
      fetchTagsAndCounts(); // Refresh list
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleOpenEditModal = (tag: TagData) => {
    setTagToEdit(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color || '');
    setIsEditModalOpen(true);
  };

  const handleEditTagSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tagToEdit || !editTagName.trim()) {
      toast.error("Tag name is required.");
      return;
    }
    if (editTagColor && !/^#([0-9A-Fa-f]{3}){1,2}$/i.test(editTagColor)) {
        toast.error('Invalid hex color format (e.g., #RRGGBB or #RGB). Leave empty for default.');
        return;
    }
    setIsEditingTag(true);
    // For MVP, this is a stub as backend PATCH /api/tags/[id] is not implemented yet
    // In a full implementation, would call:
    // PATCH /api/tags/${tagToEdit.id} with { name: editTagName, color: editTagColor || null }
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
    toast.success(`(Stub) Tag "${editTagName}" settings would be saved.`);
    // Assuming success:
    // fetchTagsAndCounts();
    setIsEditModalOpen(false);
    setTagToEdit(null);
    setIsEditingTag(false);
  };


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold flex items-center"><TagIcon className="mr-3 h-8 w-8 text-primary"/> Manage Tags</h1>
        {/* Create Tag Dialog */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-5 w-5" /> Create New Tag</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Tag</DialogTitle>
              <DialogDescription>Define a name and an optional color for your new tag.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTagSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="new-tag-name">Tag Name</Label>
                <Input id="new-tag-name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="e.g., Work, Health, Urgent" required />
              </div>
              <div>
                <Label htmlFor="new-tag-color" className="flex items-center">
                    <Palette className="mr-2 h-4 w-4 text-muted-foreground"/> Color (Optional Hex e.g. #FF5733)
                </Label>
                <Input id="new-tag-color" type="text" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} placeholder="#RRGGBB or #RGB" />
                {newTagColor && /^#([0-9A-Fa-f]{3}){1,2}$/i.test(newTagColor) && <div className="w-6 h-6 mt-1 rounded border" style={{backgroundColor: newTagColor}}></div>}
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isCreatingTag}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isCreatingTag}>
                  {isCreatingTag ? 'Creating...' : 'Create Tag'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="text-center py-10"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground"/></div>}
      {error && !error.includes("Tag system not fully configured") && <div className="text-red-500 p-4 border border-red-500/50 bg-red-500/10 rounded-md text-center flex items-center justify-center gap-2"><AlertTriangle size={18}/> Error: {error}</div>}

      {!isLoading && tagsWithCounts.length === 0 && (
        <div className="text-center py-10 text-muted-foreground bg-card border rounded-lg p-6">
          <TagIcon className="mx-auto h-12 w-12 opacity-30 mb-4"/>
          {error && error.includes("Tag system not fully configured")
            ? "Tag system is not yet fully configured in the backend."
            : "No tags created yet. Start organizing by creating your first tag!"}
        </div>
      )}

      {!isLoading && tagsWithCounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Tags</CardTitle>
            <CardDescription>Overview of your tags and their usage.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-20rem)] sm:h-[calc(100vh-22rem)]"> {/* Adjust height as needed */}
              <div className="space-y-2 pr-3">
                {tagsWithCounts.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-muted/30">
                    <div className="flex items-center space-x-3">
                      <span
                        className="w-4 h-4 rounded-sm border flex-shrink-0"
                        style={{ backgroundColor: tag.color || '#e2e8f0' }}
                        title={tag.color || 'Default Color'}
                      ></span>
                      <span className="font-medium text-sm truncate" title={tag.name}>{tag.name}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                      <span title="Habits using this tag" className="flex items-center"><Activity className="mr-1 h-3.5 w-3.5"/>{tag.habitCount}</span>
                      <span title="Quests using this tag" className="flex items-center"><ShieldCheck className="mr-1 h-3.5 w-3.5"/>{tag.questCount}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-700" onClick={() => handleOpenEditModal(tag)} title="Edit Tag (Stub)">
                        <Edit className="h-4 w-4"/>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDeleteTag(tag.id, tag.name)} title="Delete Tag">
                        <Trash2 className="h-4 w-4"/>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Edit Tag Dialog (Stub) */}
      {tagToEdit && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Tag: {tagToEdit.name}</DialogTitle>
              <DialogDescription>Modify the name and color of your tag.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditTagSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-tag-name">Tag Name</Label>
                <Input id="edit-tag-name" value={editTagName} onChange={(e) => setEditTagName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="edit-tag-color" className="flex items-center">
                  <Palette className="mr-2 h-4 w-4 text-muted-foreground"/> Color (Optional Hex)
                </Label>
                <Input id="edit-tag-color" type="text" value={editTagColor} onChange={(e) => setEditTagColor(e.target.value)} placeholder="#RRGGBB or #RGB" />
                {editTagColor && /^#([0-9A-Fa-f]{3}){1,2}$/i.test(editTagColor) && <div className="w-6 h-6 mt-1 rounded border" style={{backgroundColor: editTagColor}}></div>}
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isEditingTag}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isEditingTag}>
                  {isEditingTag ? 'Saving...' : 'Save Changes (Stub)'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TagManagerPage;
