import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

interface ActiveFilterChipsProps {
  chips: FilterChip[];
  onClearAll: () => void;
  /** Optional live result summary, e.g. "245 of 2707 documents". */
  resultCount?: number;
  totalCount?: number;
}

export function ActiveFilterChips({
  chips,
  onClearAll,
  resultCount,
  totalCount,
}: ActiveFilterChipsProps) {
  const showSummary = typeof resultCount === 'number' && typeof totalCount === 'number';
  if (chips.length === 0 && !showSummary) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {chips.length > 0 && (
        <span className="text-xs font-medium text-muted-foreground">Filters:</span>
      )}
      {chips.map((chip) => (
        <Badge key={chip.id} variant="secondary" className="gap-1 pr-1 font-normal">
          <span className="max-w-[220px] truncate">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            aria-label={`Remove filter ${chip.label}`}
            title="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {chips.length > 0 && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearAll}>
          Clear all
        </Button>
      )}
      {showSummary && (
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {resultCount!.toLocaleString()} of {totalCount!.toLocaleString()} documents
        </span>
      )}
    </div>
  );
}
