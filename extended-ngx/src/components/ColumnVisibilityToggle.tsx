import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ColumnVisibility } from '@/types';

interface ColumnVisibilityToggleProps {
  columns: { id: string; label: string }[];
  visibility: ColumnVisibility;
  onVisibilityChange: (visibility: ColumnVisibility) => void;
}

export function ColumnVisibilityToggle({
  columns,
  visibility,
  onVisibilityChange,
}: ColumnVisibilityToggleProps) {
  // Remove toggleColumn, use checked value directly in handler

  const toggleAll = (visible: boolean) => {
    const newVisibility: ColumnVisibility = {};
    columns.forEach((col) => {
      newVisibility[col.id] = visible;
    });
    onVisibilityChange(newVisibility);
  };

  const visibleCount = Object.values(visibility).filter(Boolean).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Columns ({visibleCount}/{columns.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleAll(true)}
              className="h-7 text-xs"
            >
              Show All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleAll(false)}
              className="h-7 text-xs"
            >
              Hide All
            </Button>
          </div>
          {columns.map((column) => (
            <div key={column.id} className="flex items-center space-x-2">
              <Checkbox
                id={`col-${column.id}`}
                checked={visibility[column.id] ?? true}
                onCheckedChange={(checked) => onVisibilityChange({ ...visibility, [column.id]: checked === true })}
              />
              <Label
                htmlFor={`col-${column.id}`}
                className="text-sm font-normal cursor-pointer"
              >
                {column.label}
              </Label>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
