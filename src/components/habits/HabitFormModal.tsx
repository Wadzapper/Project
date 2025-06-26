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
export interface HabitFormData {
  id?: string;
  name: string;
  description: string; // Changed from description? to description
  type: HabitType;
  goalType: HabitGoalType;
  frequency: number;
  periodInDays?: number | null;
  tags: string; // Storing as comma-separated string in form state
  archived: boolean; // Added archived state
}

interface HabitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // onSubmit in HabitsPage.tsx expects tags as string[], so conversion will happen there or before calling it
  onSubmit: (habitData: Omit<HabitFormData, 'tags'> & { tags: string[] }) => Promise<void>;
  initialData?: HabitFormData | null; // This should come from HabitsPage.tsx with tags as string
  mode: 'create' | 'edit';
  isLoading?: boolean;
  error?: string | null; // For server-side errors passed back
}

const defaultFormData: HabitFormData = {
  name: '',
  description: '',
  type: HabitType.GOOD,
  goalType: HabitGoalType.DAILY,
  frequency: 1,
  periodInDays: null,
  tags: '',
  archived: false,
};

export default function HabitFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  isLoading = false,
  error = null, // Prop for displaying submission error
}: HabitFormModalProps) {
  const [formData, setFormData] = useState<HabitFormData>(initialData || defaultFormData);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setFormData({
          ...initialData,
          // Ensure periodInDays is correctly nulled if not TIMES_PER_PERIOD
          periodInDays: initialData.goalType === HabitGoalType.TIMES_PER_PERIOD ? initialData.periodInDays : null,
        });
      } else {
        // For create mode, or if initialData is somehow null in edit mode
        setFormData(defaultFormData);
      }
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

  const handleSelectChange = (name: keyof HabitFormData, value: string) => {
    setFormData(prev => {
      const updatedState = { ...prev, [name]: value };
      if (name === 'goalType' && value !== HabitGoalType.TIMES_PER_PERIOD) {
        updatedState.periodInDays = null;
      }
      return updatedState;
    });
  };

  const handleCheckboxChange = (name: keyof HabitFormData, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Habit name is required.'); return; }
    if (formData.frequency === null || formData.frequency <= 0) { toast.error('Frequency must be a positive number.'); return; }
    if (formData.goalType === HabitGoalType.TIMES_PER_PERIOD && (formData.periodInDays === null || formData.periodInDays <= 0)) {
        toast.error('Period (in days) is required and must be positive for "Times per period" goal type.'); return;
    }

    // Convert tags string to array for submission, matching what HabitsPage.tsx expects
    const tagsArray = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    const dataToSubmit = {
        ...formData,
        tags: tagsArray,
        frequency: Number(formData.frequency) || 1,
        periodInDays: formData.goalType === HabitGoalType.TIMES_PER_PERIOD ? (Number(formData.periodInDays) || null) : null,
    };
    await onSubmit(dataToSubmit);
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
              <Select name="type" value={formData.type} onValueChange={(value) => handleSelectChange('type', value)} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {Object.values(HabitType).map(type => <SelectItem key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="goalType">Goal Type</Label>
              <Select name="goalType" value={formData.goalType} onValueChange={(value) => handleSelectChange('goalType', value)} disabled={isLoading}>
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

          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input type="text" name="tags" id="tags" value={formData.tags} onChange={handleInputChange} disabled={isLoading} placeholder="e.g. health, productivity, morning" />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox id="archived" name="archived" checked={formData.archived} onCheckedChange={(checked) => handleCheckboxChange('archived', !!checked)} disabled={isLoading} />
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
