import { useState } from 'react';
import { Bookmark, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/lib/storage';
import { format } from 'date-fns';
import type { FilterPreset, FilterState } from '@/types';

interface FilterPresetsProps {
  /** The filter state to capture when saving. */
  current: FilterState;
  /** Hydrate the Filters UI with a saved preset. */
  onApply: (state: FilterState) => void;
  /** Whether the current state has anything worth saving. */
  canSave: boolean;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function FilterPresets({ current, onApply, canSave }: FilterPresetsProps) {
  const [presets, setPresets] = useLocalStorage<FilterPreset[]>(STORAGE_KEYS.filterPresets, []);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  const saveCurrent = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const preset: FilterPreset = {
      id: newId(),
      name: trimmed,
      state: current,
      createdAt: new Date().toISOString(),
    };
    setPresets((prev) => [preset, ...prev]);
    setName('');
    setSaving(false);
  };

  const removePreset = (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex items-center gap-2">
      {saving ? (
        <>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveCurrent();
              if (e.key === 'Escape') { setSaving(false); setName(''); }
            }}
            placeholder="Preset name"
            className="h-8 w-40 text-sm"
            aria-label="Preset name"
          />
          <Button size="sm" className="h-8" onClick={saveCurrent} disabled={!name.trim()}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => { setSaving(false); setName(''); }}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => setSaving(true)}
          disabled={!canSave}
          title={canSave ? 'Save current filters as a preset' : 'Set some filters first'}
        >
          <Plus className="h-4 w-4 mr-1" />
          Save preset
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-8" disabled={presets.length === 0}>
            <Bookmark className="h-4 w-4 mr-1" />
            Presets
            {presets.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">
                {presets.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Saved filters</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {presets.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">No presets yet.</div>
          )}
          {presets.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onSelect={() => onApply(preset.state)}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex flex-col min-w-0">
                <span className="truncate text-sm">{preset.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(preset.createdAt), 'MMM dd, yyyy')}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePreset(preset.id);
                }}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label={`Delete preset ${preset.name}`}
                title="Delete preset"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
