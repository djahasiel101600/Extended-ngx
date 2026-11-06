import { useMemo, useState } from 'react';
import { Search, Settings2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ColumnDefMeta, ColumnVisibility } from '@/types';
import { isColumnVisible } from '@/lib/columns';

interface ColumnManagerProps {
  columns: ColumnDefMeta[];
  /** Explicit user overrides only; defaults are resolved via isColumnVisible. */
  visibility: ColumnVisibility;
  onVisibilityChange: (visibility: ColumnVisibility) => void;
  onReset: () => void;
}

export function ColumnManager({
  columns,
  visibility,
  onVisibilityChange,
  onReset,
}: ColumnManagerProps) {
  const [query, setQuery] = useState('');

  const coreCols = useMemo(() => columns.filter((c) => c.group === 'core'), [columns]);
  const customCols = useMemo(() => columns.filter((c) => c.group === 'custom'), [columns]);

  const visibleCount = columns.filter((c) => isColumnVisible(visibility, c.id)).length;

  const matches = (label: string) =>
    label.toLowerCase().includes(query.trim().toLowerCase());

  const setVisible = (id: string, visible: boolean) => {
    onVisibilityChange({ ...visibility, [id]: visible });
  };

  const setMany = (ids: string[], visible: boolean) => {
    const next = { ...visibility };
    ids.forEach((id) => (next[id] = visible));
    onVisibilityChange(next);
  };

  const renderRow = (col: ColumnDefMeta) => {
    const checked = isColumnVisible(visibility, col.id);
    return (
      <div key={col.id} className="flex items-center space-x-2 py-0.5">
        <Checkbox
          id={`col-${col.id}`}
          checked={checked}
          onCheckedChange={(c) => setVisible(col.id, c === true)}
        />
        <Label htmlFor={`col-${col.id}`} className="text-sm font-normal cursor-pointer truncate">
          {col.label}
        </Label>
      </div>
    );
  };

  const visibleCore = coreCols.filter((c) => matches(c.label));
  const visibleCustom = customCols.filter((c) => matches(c.label));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Columns ({visibleCount}/{columns.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="p-2 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a column..."
              className="pl-8 h-8 text-sm"
              aria-label="Search columns"
            />
          </div>

          {/* Global actions */}
          <div className="flex items-center justify-between gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setMany(columns.map((c) => c.id), true)}
            >
              Show All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setMany(columns.map((c) => c.id), false)}
            >
              Hide All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onReset}
              title="Reset to default columns"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {visibleCore.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Core
                <Button
                  variant="ghost"
                  size="sm"
                  className="float-right h-5 px-1.5 text-[10px]"
                  onClick={() => setMany(coreCols.map((c) => c.id), !coreCols.every((c) => isColumnVisible(visibility, c.id)))}
                >
                  Toggle
                </Button>
              </DropdownMenuLabel>
              <div className="px-2 py-1">{visibleCore.map(renderRow)}</div>
            </>
          )}

          {visibleCustom.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Custom Fields
                <Button
                  variant="ghost"
                  size="sm"
                  className="float-right h-5 px-1.5 text-[10px]"
                  onClick={() => setMany(customCols.map((c) => c.id), !customCols.every((c) => isColumnVisible(visibility, c.id)))}
                >
                  Toggle
                </Button>
              </DropdownMenuLabel>
              <div className="px-2 py-1">{visibleCustom.map(renderRow)}</div>
            </>
          )}

          {visibleCore.length === 0 && visibleCustom.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No columns match “{query}”.
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
