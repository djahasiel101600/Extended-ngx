import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Calendar as CalendarIcon, Plus, Search, X, Filter, Tags as TagsIcon, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ActiveFilterChips, type FilterChip } from '@/components/ActiveFilterChips';
import { FilterPresets } from '@/components/FilterPresets';
import type {
  CustomField,
  CustomFieldFilter,
  DocumentType,
  DocumentFilters,
  FilterState,
  Tag,
} from '@/types';

interface FiltersProps {
  customFields: CustomField[];
  documentTypes: DocumentType[];
  tags: Tag[];
  onFiltersChange: (filters: DocumentFilters) => void;
  isLoading?: boolean;
  disableRealTimeUpdates?: boolean;
  resultCount?: number;
  totalCount?: number;
}

const DATE_PRESETS = [
  { label: 'Any Date', value: 'any' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: 'last7days' },
  { label: 'Last 30 Days', value: 'last30days' },
  { label: 'This Month', value: 'thismonth' },
  { label: 'Last Month', value: 'lastmonth' },
  { label: 'Custom Range', value: 'custom' },
];

const isBlank = (v: unknown) => v === null || v === undefined || v === '' || v === 'all';

/** Turn one condition into a Paperless custom_field_query tuple, or null if empty. */
function conditionToQuery(c: CustomFieldFilter): [string, string, unknown] | null {
  if (c.operator === 'range') {
    const hasMin = !isBlank(c.value);
    const hasMax = !isBlank(c.valueUpper);
    if (hasMin && hasMax) return [c.fieldName, 'range', [c.value, c.valueUpper]];
    if (hasMin) return [c.fieldName, 'gte', c.value];
    if (hasMax) return [c.fieldName, 'lte', c.valueUpper];
    return null;
  }
  if (isBlank(c.value)) return null;
  return [c.fieldName, c.operator, c.value];
}

function makeCondition(field: CustomField): CustomFieldFilter {
  const base = { fieldId: field.id, fieldName: field.name, fieldType: field.data_type };
  switch (field.data_type) {
    case 'integer':
    case 'float':
    case 'monetary':
    case 'date':
      return { ...base, operator: 'range', value: null };
    case 'select':
    case 'boolean':
      return { ...base, operator: 'exact', value: null };
    default: // string, url
      return { ...base, operator: 'icontains', value: '' };
  }
}

export function Filters({
  customFields,
  documentTypes,
  tags,
  onFiltersChange,
  isLoading,
  disableRealTimeUpdates = false,
  resultCount,
  totalCount,
}: FiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('all');
  const [datePreset, setDatePreset] = useState('any');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [conditions, setConditions] = useState<CustomFieldFilter[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagMatch, setTagMatch] = useState<'any' | 'all'>('any');
  const [tagExclude, setTagExclude] = useState<boolean>(false);
  const [tagQuery, setTagQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 400);

  // Keyboard: "/" focuses the full-text search (unless already typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (typing) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- condition helpers (one entry per custom field id) ----
  const patchCondition = useCallback((fieldId: number, patch: Partial<CustomFieldFilter>) => {
    setConditions((prev) => prev.map((c) => (c.fieldId === fieldId ? { ...c, ...patch } : c)));
  }, []);
  const removeCondition = useCallback((fieldId: number) => {
    setConditions((prev) => prev.filter((c) => c.fieldId !== fieldId));
  }, []);
  const addCondition = useCallback((field: CustomField) => {
    setConditions((prev) => (prev.some((c) => c.fieldId === field.id) ? prev : [...prev, makeCondition(field)]));
    setAddOpen(false);
  }, []);

  const availableFields = useMemo(
    () => customFields.filter((f) => !conditions.some((c) => c.fieldId === f.id)),
    [customFields, conditions],
  );

  const buildCustomFieldQuery = useCallback((): string => {
    const tuples = conditions
      .map(conditionToQuery)
      .filter((t): t is [string, string, unknown] => t !== null);
    if (tuples.length === 0) return '';
    if (tuples.length === 1) return JSON.stringify(tuples[0]);
    return JSON.stringify(['AND', tuples]);
  }, [conditions]);

  const prevFiltersRef = useRef<string>('');

  const applyFilters = useCallback(() => {
    const filters: DocumentFilters = {};
    if (debouncedSearchQuery && debouncedSearchQuery.trim()) filters.query = debouncedSearchQuery.trim();
    if (selectedDocType && selectedDocType !== 'all') filters.document_type__id = parseInt(selectedDocType);
    if (dateFrom) filters.created__date__gte = format(dateFrom, 'yyyy-MM-dd');
    if (dateTo) filters.created__date__lte = format(dateTo, 'yyyy-MM-dd');
    const customQuery = buildCustomFieldQuery();
    if (customQuery) filters.custom_field_query = customQuery;
    if (selectedTagIds.length > 0) {
      const joined = selectedTagIds.join(',');
      if (tagExclude) {
        // Inverted: hide documents carrying the selected tags (handled
        // client-side by the API layer, since the backend has no negated
        // tag filter param).
        filters.excludeTagIds = selectedTagIds;
        filters.excludeTagMatch = tagMatch;
      } else if (tagMatch === 'all') {
        filters.tags__id__all = joined;
      } else {
        filters.tags__id__in = joined;
      }
    }

    const key = JSON.stringify(filters);
    if (key !== prevFiltersRef.current) {
      prevFiltersRef.current = key;
      onFiltersChange(filters);
    }
  }, [debouncedSearchQuery, selectedDocType, dateFrom, dateTo, buildCustomFieldQuery, selectedTagIds, tagMatch, tagExclude, onFiltersChange]);

  useEffect(() => {
    if (!disableRealTimeUpdates) applyFilters();
  }, [applyFilters, disableRealTimeUpdates]);

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    switch (preset) {
      case 'today': setDateFrom(today); setDateTo(today); break;
      case 'last7days': setDateFrom(subDays(today, 7)); setDateTo(today); break;
      case 'last30days': setDateFrom(subDays(today, 30)); setDateTo(today); break;
      case 'thismonth': setDateFrom(startOfMonth(today)); setDateTo(today); break;
      case 'lastmonth': {
        const lm = subMonths(today, 1);
        setDateFrom(startOfMonth(lm)); setDateTo(endOfMonth(lm)); break;
      }
      case 'any': setDateFrom(undefined); setDateTo(undefined); break;
      case 'custom': break; // dates chosen in the range picker
    }
  };

  const clearDate = () => { setDatePreset('any'); setDateFrom(undefined); setDateTo(undefined); };

  const getState = (): FilterState => ({
    query: searchQuery,
    documentTypeId: selectedDocType,
    datePreset,
    dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
    dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
    customFieldFilters: conditions,
    tagIds: selectedTagIds,
    tagMatch,
    tagExclude,
  });

  const applyState = (s: FilterState) => {
    setSearchQuery(s.query || '');
    setSelectedDocType(s.documentTypeId || 'all');
    setDatePreset(s.datePreset || 'any');
    setDateFrom(s.dateFrom ? new Date(s.dateFrom) : undefined);
    setDateTo(s.dateTo ? new Date(s.dateTo) : undefined);
    setConditions(s.customFieldFilters || []);
    setSelectedTagIds(s.tagIds || []);
    setTagMatch(s.tagMatch || 'any');
    setTagExclude(!!s.tagExclude);
    toast.info('Preset applied.');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedDocType('all');
    setDatePreset('any');
    setDateFrom(undefined);
    setDateTo(undefined);
    setConditions([]);
    setSelectedTagIds([]);
    setTagMatch('any');
    setTagExclude(false);
    toast.info('Filters reset.', { description: 'All filters cleared.' });
    if (disableRealTimeUpdates) setTimeout(() => onFiltersChange({}), 0);
  };

  // ---- value description for chips ----
  const describeCondition = (c: CustomFieldFilter): string => {
    if (c.operator === 'range') {
      const min = isBlank(c.value) ? '' : String(c.value);
      const max = isBlank(c.valueUpper) ? '' : String(c.valueUpper);
      if (min && max) return `${min} – ${max}`;
      if (min) return `≥ ${min}`;
      if (max) return `≤ ${max}`;
      return '';
    }
    if (c.fieldType === 'boolean') return c.value === true ? 'Yes' : c.value === false ? 'No' : '';
    if (c.fieldType === 'select') {
      const field = customFields.find((f) => f.id === c.fieldId);
      const opt = field?.extra_data?.select_options?.find((o) => String(o.id) === String(c.value));
      return opt?.label ?? String(c.value ?? '');
    }
    return String(c.value ?? '');
  };

  // ---- active filter chips ----
  const chips: FilterChip[] = [];
  if (searchQuery.trim()) chips.push({ id: 'q', label: `Search: “${searchQuery.trim()}”`, onRemove: () => setSearchQuery('') });
  if (selectedDocType !== 'all') {
    const name = documentTypes.find((t) => String(t.id) === selectedDocType)?.name ?? 'Type';
    chips.push({ id: 'dt', label: `Type: ${name}`, onRemove: () => setSelectedDocType('all') });
  }
  if (datePreset !== 'any' || dateFrom || dateTo) {
    const label = dateFrom && dateTo
      ? `Created: ${format(dateFrom, 'MMM dd')} – ${format(dateTo, 'MMM dd, yyyy')}`
      : `Created: ${DATE_PRESETS.find((p) => p.value === datePreset)?.label ?? 'Custom'}`;
    chips.push({ id: 'date', label, onRemove: clearDate });
  }
  conditions.forEach((c) => {
    const desc = describeCondition(c);
    if (desc) chips.push({ id: `cf_${c.fieldId}`, label: `${c.fieldName}: ${desc}`, onRemove: () => removeCondition(c.fieldId) });
  });
  if (selectedTagIds.length > 0) {
    const names = selectedTagIds
      .map((id) => tags.find((t) => t.id === id)?.name ?? String(id))
      .join(', ');
    chips.push({
      id: 'tags',
      label: tagExclude
        ? `Tags: NOT (${tagMatch === 'all' ? 'all' : 'any'}) ${names}`
        : `Tags (${tagMatch === 'all' ? 'all' : 'any'}): ${names}`,
      onRemove: () => {
        setSelectedTagIds([]);
        setTagExclude(false);
      },
    });
  }

  const hasActiveFilters = chips.length > 0;

  // ---- per-condition control ----
  const renderConditionControl = (c: CustomFieldFilter) => {
    const field = customFields.find((f) => f.id === c.fieldId);
    if (!field) return null;

    switch (field.data_type) {
      case 'select': {
        const options = field.extra_data?.select_options || [];
        return (
          <Select
            value={isBlank(c.value) ? 'all' : String(c.value)}
            onValueChange={(v) => patchCondition(c.fieldId, { value: v === 'all' ? null : (isNaN(Number(v)) ? v : Number(v)) })}
          >
            <SelectTrigger className="h-8 w-full sm:w-52"><SelectValue placeholder={`All ${c.fieldName}`} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {c.fieldName}</SelectItem>
              {options.map((opt) => (
                <SelectItem key={opt.id} value={String(opt.id)}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      case 'boolean':
        return (
          <Select
            value={c.value === null || c.value === undefined ? 'all' : String(c.value)}
            onValueChange={(v) => patchCondition(c.fieldId, { value: v === 'all' ? null : v === 'true' })}
          >
            <SelectTrigger className="h-8 w-full sm:w-52"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        );
      case 'integer':
      case 'float':
      case 'monetary':
      case 'date': {
        return (
          <div className="flex items-center gap-1.5">
            {field.data_type === 'date' ? (
              <>
                <Input type="date" value={c.value ? String(c.value) : ''} className="h-8 w-auto"
                  onChange={(e) => patchCondition(c.fieldId, { value: e.target.value || null })} />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={c.valueUpper ? String(c.valueUpper) : ''} className="h-8 w-auto"
                  onChange={(e) => patchCondition(c.fieldId, { valueUpper: e.target.value || null })} />
              </>
            ) : (
              <>
                <Input type="number" placeholder="Min" value={c.value != null ? String(c.value) : ''} className="h-8 w-24"
                  onChange={(e) => patchCondition(c.fieldId, { value: e.target.value === '' ? null : parseFloat(e.target.value) })} />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="number" placeholder="Max" value={c.valueUpper != null ? String(c.valueUpper) : ''} className="h-8 w-24"
                  onChange={(e) => patchCondition(c.fieldId, { valueUpper: e.target.value === '' ? null : parseFloat(e.target.value) })} />
              </>
            )}
          </div>
        );
      }
      default: // string, url
        return (
          <Input
            placeholder={`Contains “${c.fieldName}”…`}
            value={c.value != null ? String(c.value) : ''}
            className="h-8 w-full sm:w-52"
            onChange={(e) => patchCondition(c.fieldId, { value: e.target.value })}
          />
        );
    }
  };

  const rangeSelected = dateFrom ? { from: dateFrom, to: dateTo ?? dateFrom } : undefined;

  // ---- tag multi-select helpers ----
  const toggleTag = (id: number) => {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const filteredTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name));
    return q ? sorted.filter((t) => t.name.toLowerCase().includes(q)) : sorted;
  }, [tags, tagQuery]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {hasActiveFilters && <Badge variant="secondary">{chips.length} active</Badge>}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <FilterPresets current={getState()} onApply={applyState} canSave={hasActiveFilters} />
            {disableRealTimeUpdates && (
              <Button size="sm" onClick={applyFilters} disabled={isLoading}>Apply</Button>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />Clear All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search + basic filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Full-text Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                className="pl-9"
                placeholder="Search documents…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Document Type</Label>
            <Select value={selectedDocType} onValueChange={setSelectedDocType}>
              <SelectTrigger><SelectValue placeholder="All Document Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Document Types</SelectItem>
                {documentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id.toString()}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Date Range</Label>
            <div className="flex gap-2">
              <Select value={datePreset} onValueChange={handleDatePresetChange}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Date Range" /></SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('px-3', !dateFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={rangeSelected}
                    onSelect={(r) => { setDateFrom(r?.from); setDateTo(r?.to); setDatePreset('custom'); }}
                    numberOfMonths={2}
                    captionLayout="dropdown"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TagsIcon className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Tags</Label>
              </div>
              <span className="text-xs text-muted-foreground">
                {selectedTagIds.length === 0
                  ? 'No tag filter — showing all documents'
                  : `${tagExclude ? 'Hiding' : 'Showing'} documents ${tagMatch === 'all' ? 'with all' : 'with any'} of ${selectedTagIds.length} tag${selectedTagIds.length > 1 ? 's' : ''}`}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'h-9 min-w-[220px] justify-start gap-2 font-normal',
                      tagExclude && selectedTagIds.length > 0 && 'border-destructive/50 text-destructive hover:text-destructive',
                    )}
                  >
                    {tagExclude && selectedTagIds.length > 0 ? (
                      <Ban className="h-4 w-4 shrink-0" />
                    ) : (
                      <TagsIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    {selectedTagIds.length === 0 ? (
                      <span className="text-muted-foreground">Select tags…</span>
                    ) : (
                      <span>
                        {tagExclude ? 'Excluding ' : ''}
                        {selectedTagIds.length} tag{selectedTagIds.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="flex max-h-[min(85vh,32rem)] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0">
                  <div className="shrink-0 border-b p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        autoFocus
                        placeholder="Search tags…"
                        value={tagQuery}
                        onChange={(e) => setTagQuery(e.target.value)}
                        className="h-8 pl-8"
                      />
                    </div>
                  </div>
                  <ScrollArea className="min-h-0 flex-1 overflow-hidden">
                    <div className="w-full overflow-hidden p-1">
                      {filteredTags.length === 0 && (
                        <div className="px-2 py-3 text-sm text-muted-foreground">No tags match.</div>
                      )}
                      {filteredTags.map((t) => (
                        <label
                          key={t.id}
                          className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                        >
                          <Checkbox
                            checked={selectedTagIds.includes(t.id)}
                            onCheckedChange={() => toggleTag(t.id)}
                            className="shrink-0"
                          />
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border"
                            style={{ backgroundColor: t.color }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Match mode + exclude controls */}
                  <div className="shrink-0 space-y-2 border-t bg-popover p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex rounded-md border p-0.5">
                        {(['any', 'all'] as const).map((m) => (
                          <Button
                            key={m}
                            type="button"
                            size="sm"
                            variant={tagMatch === m ? 'secondary' : 'ghost'}
                            className="h-7 px-3 text-xs"
                            disabled={selectedTagIds.length === 0}
                            onClick={() => setTagMatch(m)}
                          >
                            Match {m}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={selectedTagIds.length === 0}
                        onClick={() => setSelectedTagIds([])}
                      >
                        Clear
                      </Button>
                    </div>

                    <label
                      className={cn(
                        'flex items-start gap-2 rounded-md p-2',
                        selectedTagIds.length === 0 ? 'opacity-50' : 'cursor-pointer bg-muted/50',
                      )}
                    >
                      <Checkbox
                        checked={tagExclude}
                        disabled={selectedTagIds.length === 0}
                        onCheckedChange={(v) => setTagExclude(!!v)}
                        className="mt-0.5"
                      />
                      <span className="text-xs leading-tight">
                        <span className="font-medium">Exclude selected tags</span>
                        <span className="block text-muted-foreground">
                          Invert the filter — show documents that do <em>not</em> have the selected tags.
                        </span>
                      </span>
                    </label>
                  </div>
                </PopoverContent>
              </Popover>

              {selectedTagIds.length > 0 && (
                <Badge variant={tagExclude ? 'destructive' : 'secondary'} className="gap-1">
                  {tagExclude ? 'Not tagged' : `Match ${tagMatch}`}
                </Badge>
              )}
            </div>

            {selectedTagIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedTagIds.map((id) => {
                  const t = tags.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <Badge key={id} variant="outline" className="gap-1.5 font-normal">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.color }} aria-hidden="true" />
                      <span className={cn(tagExclude && 'text-muted-foreground line-through')}>{t.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleTag(id)}
                        aria-label={`Remove ${t.name} tag`}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Custom-field conditions */}
        {customFields.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Custom Field Conditions</Label>
              <Popover open={addOpen} onOpenChange={setAddOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" disabled={availableFields.length === 0}>
                    <Plus className="h-4 w-4 mr-1" />Add condition
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-1">
                  <div className="max-h-72 overflow-y-auto">
                    {availableFields.length === 0 && (
                      <div className="px-2 py-3 text-sm text-muted-foreground">All fields are filtered.</div>
                    )}
                    {availableFields.map((f) => (
                      <Button
                        key={f.id}
                        variant="ghost"
                        className="w-full justify-start text-sm font-normal"
                        onClick={() => addCondition(f)}
                      >
                        {f.name}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {conditions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No custom-field conditions. Add one to filter on fields like dates, amounts or categories.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {conditions.map((c) => (
                  <div key={c.fieldId} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1.5">
                    <span className="text-xs font-medium text-muted-foreground truncate max-w-[140px]">{c.fieldName}</span>
                    {renderConditionControl(c)}
                    <button
                      type="button"
                      onClick={() => removeCondition(c.fieldId)}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label={`Remove ${c.fieldName} condition`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <ActiveFilterChips chips={chips} onClearAll={clearFilters} resultCount={resultCount} totalCount={totalCount} />
      </CardContent>
    </Card>
  );
}
