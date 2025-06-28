'use client';

import { useEffect, useState, FormEvent } from 'react';
import { HabitType, HabitGoalType } from '@prisma/client';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';

// This interface should align with the one in HabitsPage.tsx for initialData
// AND the data structure expected by the API (now using tagIds)
export interface HabitFormData {
  id?: string;
  name: string;
  description: string;
  type: HabitType;
  goalType: HabitGoalType;
  frequency: number;
  periodInDays?: number | null;
  tagIds: string[]; // Changed from tags: string to tagIds: string[]
  archived: boolean;
}

// For fetching and displaying available tags
interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

interface HabitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (habitData: HabitFormData) => Promise<void>;
  initialData?: Omit<HabitFormData, 'tagIds'> & { tags?: string[] }; // Expect tags as string[]
  mode: 'create' | 'edit';
  isLoading?: boolean;
  error?: string | null;
}

const defaultFormData: HabitFormData = {
  name: '',
  description: '',
  type: HabitType.GOOD,
  goalType: HabitGoalType.DAILY,
  frequency: 1,
  periodInDays: null,
  tagIds: [],
  archived: false,
};

export default function HabitFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  isLoading = false,
  error = null,
}: HabitFormModalProps) {
  const [formData, setFormData] = useState<HabitFormData>(() => {
    if (mode === 'edit' && initialData) {
      return {
        ...defaultFormData,
        ...initialData,
        tagIds: initialData.tags || [], // Directly use string[]
        periodInDays: initialData.goalType === HabitGoalType.TIMES_PER_PERIOD ? initialData.periodInDays : null,
      };
    }
    return defaultFormData;
  });

  const [availableTags, setAvailableTags] = useState<Tag[]>([]); // Still fetches Tag objects for display
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setFormData({
          ...defaultFormData,
          ...initialData,
          tagIds: initialData.tags || [], // Directly use string[]
          periodInDays: initialData.goalType === HabitGoalType.TIMES_PER_PERIOD ? initialData.periodInDays : null,
        });
      } else {
        setFormData(defaultFormData);
      }

      // Fetch available tags
      const fetchTags = async () => {
        setIsLoadingTags(true);
        try {
          const response = await fetch('/api/tags');
          if (!response.ok) throw new Error('Failed to fetch tags');
          const tagsData: Tag[] = await response.json();
          setAvailableTags(tagsData);
        } catch (err) {
          console.error("Error fetching tags for modal:", err);
          toast.error("Could not load tags.");
        } finally {
          setIsLoadingTags(false);
        }
      };
      fetchTags();
    }
  }, [isOpen, initialData, mode]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = value === '' ? null : parseInt(value, 10);
    setFormData(prev => ({ ...prev, [name]: numValue !== null && isNaN(numValue) ? prev[name as keyof HabitFormData] : numValue }));
  };

  const handleSelectChange = (name: keyof Omit<HabitFormData, 'tagIds' | 'archived'>, value: string) => {
    setFormData(prev => {
      const updatedState = { ...prev, [name]: value };
      if (name === 'goalType' && value !== HabitGoalType.TIMES_PER_PERIOD) {
        updatedState.periodInDays = null;
      }
      return updatedState;
    });
  };

  const handleArchivedCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, archived: checked }));
  };

  const handleTagSelectionChange = (tagId: string, selected: boolean) => {
    setFormData(prev => {
      const newTagIds = selected
        ? [...prev.tagIds, tagId]
        : prev.tagIds.filter(id => id !== tagId);
      return { ...prev, tagIds: newTagIds };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Habit name is required.'); return; }
    if (formData.frequency === null || formData.frequency <= 0) { toast.error('Frequency must be a positive number.'); return; }
    if (formData.goalType === HabitGoalType.TIMES_PER_PERIOD && (formData.periodInDays === null || formData.periodInDays <= 0)) {
        toast.error('Period (in days) is required and must be positive for "Times per period" goal type.'); return;
    }

    // onSubmit now expects HabitFormData directly which includes tagIds: string[]
    await onSubmit({
        ...formData,
        frequency: Number(formData.frequency) || 1,
        periodInDays: formData.goalType === HabitGoalType.TIMES_PER_PERIOD ? (Number(formData.periodInDays) || null) : null,
    });
  };

  if (!isOpen) return null;

  const getGoalTypeLabel = (goalType: HabitGoalType) => {
    return goalType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg p-6 bg-card border text-card-foreground rounded-lg shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent">
        <div className="flex items-center justify-between pb-4 mb-4 border-b">
          <h2 className="text-xl font-semibold">
            {mode === 'create' ? 'Create New Habit' : 'Edit Habit'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isLoading} aria-label="Close modal">
             <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>}

          <div>
            <Label htmlFor="name">Name</Label>
            <Input type="text" name="name" id="name" required value={formData.name} onChange={handleInputChange} disabled={isLoading} />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea name="description" id="description" rows={3} value={formData.description} onChange={handleInputChange} disabled={isLoading} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="type">Habit Type</Label>
              <Select name="type" value={formData.type} onValueChange={(value) => handleSelectChange('type' as any, value)} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {Object.values(HabitType).map(type => <SelectItem key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="goalType">Goal Type</Label>
              <Select name="goalType" value={formData.goalType} onValueChange={(value) => handleSelectChange('goalType' as any, value)} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Select goal type" /></SelectTrigger>
                <SelectContent>
                  {Object.values(HabitGoalType).map(type => <SelectItem key={type} value={type}>{getGoalTypeLabel(type)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="frequency">{formData.goalType === HabitGoalType.TIMES_PER_PERIOD ? 'Target Count' : 'Frequency (per day/week)'}</Label>
              <Input type="number" name="frequency" id="frequency" min="1" required value={formData.frequency ?? ''} onChange={handleNumberInputChange} disabled={isLoading} />
            </div>
            {formData.goalType === HabitGoalType.TIMES_PER_PERIOD && (
              <div>
                <Label htmlFor="periodInDays">Over Period (Days)</Label>
                <Input type="number" name="periodInDays" id="periodInDays" min="1" value={formData.periodInDays ?? ''} onChange={handleNumberInputChange} disabled={isLoading} />
              </div>
            )}
          </div>

          {/* Tag Selection UI */}
          <div>
            <Label>Tags</Label>
            {isLoadingTags && <p className="text-xs text-muted-foreground">Loading tags...</p>}
            {!isLoadingTags && availableTags.length === 0 && <p className="text-xs text-muted-foreground">No tags available. Create some in Tag Management.</p>}
            {!isLoadingTags && availableTags.length > 0 && (
              <div className="mt-1 space-y-2 p-2 border rounded-md max-h-32 overflow-y-auto">
                {availableTags.map(tag => (
                  <div key={tag.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={formData.tagIds.includes(tag.id)}
                      onCheckedChange={(checked) => handleTagSelectionChange(tag.id, !!checked)}
                      disabled={isLoading}
                    />
                    <Label htmlFor={`tag-${tag.id}`} className="text-sm font-normal flex items-center">
                      {tag.color && <span className="w-3 h-3 rounded-sm mr-2 inline-block border" style={{backgroundColor: tag.color}}></span>}
                      {tag.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>


          <div className="flex items-center space-x-2 pt-2">
            <Checkbox id="archived" checked={formData.archived} onCheckedChange={(checked) => handleArchivedCheckboxChange(!!checked)} disabled={isLoading} />
            <Label htmlFor="archived" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Archived
            </Label>
          </div>

          <div className="pt-6 space-x-3 text-right border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (mode === 'create' ? 'Create Habit' : 'Save Changes')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
