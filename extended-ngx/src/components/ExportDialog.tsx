import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnDefMeta, ExportFormat, ExportOptions, ExportScope } from '@/types';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defs: ColumnDefMeta[];
  visibleColumnIds: string[];
  selectedCount: number;
  currentPageCount: number;
  totalCount: number;
  isExporting: boolean;
  onSubmit: (opts: ExportOptions) => void;
}

type ColumnMode = 'visible' | 'all' | 'custom';

const NON_CONTENT = (d: ColumnDefMeta) => d.id !== 'content';

export function ExportDialog({
  open,
  onOpenChange,
  defs,
  visibleColumnIds,
  selectedCount,
  currentPageCount,
  totalCount,
  isExporting,
  onSubmit,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<ExportScope>('all');
  const [columnMode, setColumnMode] = useState<ColumnMode>('visible');
  const [customSelection, setCustomSelection] = useState<Set<string>>(new Set());
  const [includeContent, setIncludeContent] = useState(false);

  // Re-seed defaults each time the dialog opens so it reflects current state.
  useEffect(() => {
    if (open) {
      setFormat('csv');
      setScope(selectedCount > 0 ? 'selected' : 'all');
      setColumnMode('visible');
      setCustomSelection(new Set(visibleColumnIds.filter((id) => id !== 'content')));
      setIncludeContent(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const columnCandidates = useMemo(() => defs.filter(NON_CONTENT), [defs]);

  const selectedColumnIds = useMemo(() => {
    const baseIds =
      columnMode === 'visible'
        ? visibleColumnIds.filter((id) => id !== 'content')
        : columnMode === 'all'
          ? columnCandidates.map((c) => c.id)
          : columnCandidates.filter((c) => customSelection.has(c.id)).map((c) => c.id);
    const set = new Set(baseIds);
    // Emit in the canonical defs order; include content only when checked.
    return defs
      .filter((d) => (d.id === 'content' ? includeContent : set.has(d.id)))
      .map((d) => d.id);
  }, [columnMode, visibleColumnIds, columnCandidates, customSelection, defs, includeContent]);

  const scopeCount =
    scope === 'selected' ? selectedCount : scope === 'page' ? currentPageCount : totalCount;

  const canExport = selectedColumnIds.length > 0 && scopeCount > 0 && !isExporting;

  const handleExport = () => {
    onSubmit({ format, scope, columnIds: selectedColumnIds, includeContent });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export documents</DialogTitle>
          <DialogDescription>
            Choose a format, which rows to include, and which columns to write.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Format */}
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (for spreadsheets / processing)</SelectItem>
                <SelectItem value="json">JSON (structured, typed values)</SelectItem>
                <SelectItem value="pdf">PDF report (printable)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scope */}
          <div className="space-y-1.5">
            <Label>Rows</Label>
            <div className="grid grid-cols-3 gap-2">
              <ScopeButton
                active={scope === 'selected'}
                disabled={selectedCount === 0}
                onClick={() => setScope('selected')}
                label="Selected"
                count={selectedCount}
              />
              <ScopeButton
                active={scope === 'page'}
                onClick={() => setScope('page')}
                label="This page"
                count={currentPageCount}
              />
              <ScopeButton
                active={scope === 'all'}
                onClick={() => setScope('all')}
                label="All filtered"
                count={totalCount}
              />
            </div>
            {scope === 'all' && totalCount > 2000 && (
              <p className="text-xs text-destructive">
                Bulk export is capped at 2,000 rows — narrow your filters to continue.
              </p>
            )}
          </div>

          {/* Columns */}
          <div className="space-y-2">
            <Label>Columns</Label>
            <div className="grid grid-cols-3 gap-2">
              <ModeButton active={columnMode === 'visible'} onClick={() => setColumnMode('visible')} label={`Visible (${visibleColumnIds.length})`} />
              <ModeButton active={columnMode === 'all'} onClick={() => setColumnMode('all')} label={`All (${columnCandidates.length})`} />
              <ModeButton active={columnMode === 'custom'} onClick={() => setColumnMode('custom')} label={`Custom (${customSelection.size})`} />
            </div>

            {columnMode === 'custom' && (
              <div className="max-h-44 overflow-y-auto rounded-md border p-2">
                {columnCandidates.map((c) => (
                  <div key={c.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`exp-${c.id}`}
                      checked={customSelection.has(c.id)}
                      onCheckedChange={(chk) => {
                        setCustomSelection((prev) => {
                          const next = new Set(prev);
                          if (chk === true) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        });
                      }}
                    />
                    <Label htmlFor={`exp-${c.id}`} className="text-sm font-normal cursor-pointer">
                      {c.label}
                    </Label>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="exp-content"
                checked={includeContent}
                onCheckedChange={(chk) => setIncludeContent(chk === true)}
              />
              <Label htmlFor="exp-content" className="text-sm font-normal cursor-pointer">
                Include full document text (large)
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!canExport}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting
              ? 'Exporting...'
              : `Export ${scopeCount.toLocaleString()} ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScopeButton({
  active,
  disabled,
  onClick,
  label,
  count,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      className="h-auto flex-col py-2"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs opacity-80 tabular-nums">{count.toLocaleString()}</span>
    </Button>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      className="h-8 text-xs"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
