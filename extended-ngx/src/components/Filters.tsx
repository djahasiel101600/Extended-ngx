import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Calendar as CalendarIcon, Search, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CustomField, DocumentType, DocumentFilters, CustomFieldFilter } from '@/types';
import { toast } from 'sonner';

interface FiltersProps {
  customFields: CustomField[];
  documentTypes: DocumentType[];
  onFiltersChange: (filters: DocumentFilters) => void;
  isLoading?: boolean;
  disableRealTimeUpdates?: boolean;
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

export function Filters({ customFields, documentTypes, onFiltersChange, isLoading, disableRealTimeUpdates = false }: FiltersProps) {
    // Use Sonner for toast notifications

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocType, setSelectedDocType] = useState<string>('all');
  const [datePreset, setDatePreset] = useState('any');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [customFieldFilters, setCustomFieldFilters] = useState<Map<number, CustomFieldFilter>>(new Map());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, 400);

  // Apply filters whenever the debounced search query or any other filter changes.
  // (Effect moved further down so `applyFilters` is defined before usage.)

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();

    switch (preset) {
      case 'today':
        setDateFrom(today);
        setDateTo(today);
        break;
      case 'last7days':
        setDateFrom(subDays(today, 7));
        setDateTo(today);
        break;
      case 'last30days':
        setDateFrom(subDays(today, 30));
        setDateTo(today);
        break;
      case 'thismonth':
        setDateFrom(startOfMonth(today));
        setDateTo(today);
        break;
      case 'lastmonth':
        const lastMonth = subMonths(today, 1);
        setDateFrom(startOfMonth(lastMonth));
        setDateTo(endOfMonth(lastMonth));
        break;
      case 'any':
        setDateFrom(undefined);
        setDateTo(undefined);
        break;
      case 'custom':
        // Keep current dates for custom
        break;
    }
  };

  const updateCustomFieldFilter = (fieldId: number, field: CustomField, value: unknown, operator: CustomFieldFilter['operator'] = 'exact') => {
    const newFilters = new Map(customFieldFilters);
    
    if (value === null || value === undefined || value === '' || value === 'all') {
      newFilters.delete(fieldId);
    } else {
      newFilters.set(fieldId, {
        fieldId,
        fieldName: field.name,
        fieldType: field.data_type,
        value: value as CustomFieldFilter['value'],
        operator,
      });
    }
    
    setCustomFieldFilters(newFilters);
  };

  const buildCustomFieldQuery = useCallback((): string => {
    const queries: Array<[string, string, unknown]> = [];

    customFieldFilters.forEach((filter) => {
      if (filter.value !== null && filter.value !== undefined && filter.value !== '') {
        queries.push([filter.fieldName, filter.operator, filter.value]);
      }
    });

    if (queries.length === 0) return '';
    if (queries.length === 1) return JSON.stringify(queries[0]);
    return JSON.stringify(['AND', queries]);
  }, [customFieldFilters]);
  const prevFiltersRef = useRef<string>('');

  const applyFilters = useCallback(() => {
    const filters: DocumentFilters = {};

    // Use debounced search query for stable behavior
    if (debouncedSearchQuery && debouncedSearchQuery.trim()) {
      filters.query = debouncedSearchQuery.trim();
    }

    if (selectedDocType && selectedDocType !== 'all') {
      filters.document_type__id = parseInt(selectedDocType);
    }

    if (dateFrom) {
      filters.created__date__gte = format(dateFrom, 'yyyy-MM-dd');
    }

    if (dateTo) {
      filters.created__date__lte = format(dateTo, 'yyyy-MM-dd');
    }

    const customQuery = buildCustomFieldQuery();
    if (customQuery) {
      filters.custom_field_query = customQuery;
    }

    const filtersString = JSON.stringify(filters);
    // Only emit change and show toast when filters actually change
    if (filtersString !== prevFiltersRef.current) {
      prevFiltersRef.current = filtersString;
      onFiltersChange(filters);
      toast.info('Filters applied.', { description: 'Document list updated.' });
    }
  }, [debouncedSearchQuery, selectedDocType, dateFrom, dateTo, buildCustomFieldQuery, onFiltersChange]);

  // Run applyFilters when its dependencies change, unless real-time updates are disabled
  useEffect(() => {
    if (!disableRealTimeUpdates) {
      applyFilters();
    }
  }, [applyFilters, disableRealTimeUpdates]);

  // Expose applyFilters for manual triggering if needed, but for now we'll just add a manual button if RT updates are off
  const handleManualApply = () => {
    applyFilters();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedDocType('all');
    setDatePreset('any');
    setDateFrom(undefined);
    setDateTo(undefined);
    setCustomFieldFilters(new Map());
    toast.info('Filters reset.', { description: 'All filters cleared.' });
    if (disableRealTimeUpdates) {
      setTimeout(() => {
        onFiltersChange({});
      }, 0);
    }
  };

  const activeFilterCount = [
    searchQuery.trim() !== '',
    selectedDocType !== 'all',
    datePreset !== 'any',
    customFieldFilters.size > 0,
  ].filter(Boolean).length;

  const renderCustomFieldFilter = (field: CustomField) => {
    const currentFilter = customFieldFilters.get(field.id);

    switch (field.data_type) {
      case 'select': {
        const options = field.extra_data?.select_options || [];
        return (
          <div key={field.id} className="space-y-1.5">
            <Label className="text-sm">{field.name}</Label>
            <Select
              value={currentFilter?.value?.toString() || 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  updateCustomFieldFilter(field.id, field, null);
                } else {
                  const num = Number(value);
                  updateCustomFieldFilter(field.id, field, Number.isNaN(num) ? value : num);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={`All ${field.name}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {field.name}</SelectItem>
                {options.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }

      case 'string':
      case 'url':
        return (
          <div key={field.id} className="space-y-1.5">
            <Label className="text-sm">{field.name}</Label>
            <Input
              placeholder={`Search ${field.name}...`}
              value={(currentFilter?.value as string) || ''}
              onChange={(e) => updateCustomFieldFilter(field.id, field, e.target.value, 'icontains')}
            />
          </div>
        );

      case 'boolean':
        return (
          <div key={field.id} className="space-y-1.5">
            <Label className="text-sm">{field.name}</Label>
            <Select
              value={currentFilter?.value?.toString() || 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  updateCustomFieldFilter(field.id, field, null);
                } else {
                  updateCustomFieldFilter(field.id, field, value === 'true');
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Any ${field.name}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 'integer':
      case 'float':
      case 'monetary': {
        const minValue = customFieldFilters.get(field.id)?.operator === 'gte' ? currentFilter?.value : '';
        const maxFilter = Array.from(customFieldFilters.values()).find(
          f => f.fieldName === field.name && f.operator === 'lte'
        );
        const maxValue = maxFilter?.value || '';

        return (
          <div key={field.id} className="space-y-1.5">
            <Label className="text-sm">{field.name}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={minValue?.toString() || ''}
                onChange={(e) => {
                  const val = e.target.value ? parseFloat(e.target.value) : null;
                  updateCustomFieldFilter(field.id, field, val, 'gte');
                }}
              />
              <Input
                type="number"
                placeholder="Max"
                value={maxValue?.toString() || ''}
                onChange={(e) => {
                  const val = e.target.value ? parseFloat(e.target.value) : null;
                  // Use a separate key for max filter
                  const newFilters = new Map(customFieldFilters);
                  if (val === null) {
                    // Remove any lte filter for this field
                    newFilters.forEach((filter, key) => {
                      if (filter.fieldName === field.name && filter.operator === 'lte') {
                        newFilters.delete(key);
                      }
                    });
                  } else {
                    newFilters.set(field.id + 10000, {
                      fieldId: field.id,
                      fieldName: field.name,
                      fieldType: field.data_type,
                      value: val,
                      operator: 'lte',
                    });
                  }
                  setCustomFieldFilters(newFilters);
                }}
              />
            </div>
          </div>
        );
      }

      case 'date':
        return (
          <div key={field.id} className="space-y-1.5">
            <Label className="text-sm">{field.name}</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    From
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" onSelect={(date) => {
                    if (date) {
                      updateCustomFieldFilter(field.id, field, format(date, 'yyyy-MM-dd'), 'gte');
                    }
                  }} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    To
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" onSelect={(date) => {
                    if (date) {
                      const newFilters = new Map(customFieldFilters);
                      newFilters.set(field.id + 10000, {
                        fieldId: field.id,
                        fieldName: field.name,
                        fieldType: field.data_type,
                        value: format(date, 'yyyy-MM-dd'),
                        operator: 'lte',
                      });
                      setCustomFieldFilters(newFilters);
                    }
                  }} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} active</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="space-y-1.5">
          <Label className="text-sm">Full-text Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Basic Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Document Type */}
          <div className="space-y-1.5">
            <Label className="text-sm">Document Type</Label>
            <Select value={selectedDocType} onValueChange={setSelectedDocType}>
              <SelectTrigger>
                <SelectValue placeholder="All Document Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Document Types</SelectItem>
                {documentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id.toString()}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Preset */}
          <div className="space-y-1.5">
            <Label className="text-sm">Date Range</Label>
            <Select value={datePreset} onValueChange={handleDatePresetChange}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              {disableRealTimeUpdates && (
                <Button onClick={handleManualApply} disabled={isLoading}>
                  Apply Filters
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
              </Button>
            </div>
          </div>

          {/* Custom Date Range */}
          {(datePreset === 'custom' || dateFrom || dateTo) && (
            <div className="space-y-1.5">
              <Label className="text-sm">Custom Range</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, 'MMM dd, yyyy') : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => {
                        setDateFrom(date);
                        if (datePreset !== 'custom') setDatePreset('custom');
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, 'MMM dd, yyyy') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => {
                        setDateTo(date);
                        if (datePreset !== 'custom') setDatePreset('custom');
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Filters - Custom Fields */}
        {showAdvanced && customFields.length > 0 && (
          <div className="pt-4 border-t">
            <Label className="text-sm font-medium mb-3 block">Custom Field Filters</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customFields.map(renderCustomFieldFilter)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
