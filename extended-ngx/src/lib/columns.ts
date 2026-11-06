import type { ColumnDefMeta, ColumnVisibility, CustomField } from '@/types';

// The six base document columns. `id`s match the TanStack column ids used in
// DocumentTable so visibility overrides line up across the app.
export const CORE_COLUMN_DEFS: ColumnDefMeta[] = [
  { id: 'id', label: 'ID', group: 'core' },
  { id: 'title', label: 'Title', group: 'core' },
  { id: 'created', label: 'Created', group: 'core' },
  { id: 'document_type', label: 'Document Type', group: 'core' },
  { id: 'content', label: 'Content', group: 'core' },
  { id: 'owner', label: 'Owner', group: 'core' },
];

// The standardized "core-only" default view: the four columns that identify a
// document at a glance. Content/owner and every custom field start hidden.
const DEFAULT_VISIBLE_CORE = new Set(['id', 'title', 'created', 'document_type']);

// Build the shared, ordered column catalog: core columns first, then one column
// per custom field (id `cf_<fieldId>`), preserving field order.
export function buildColumnDefs(customFields: CustomField[]): ColumnDefMeta[] {
  const custom: ColumnDefMeta[] = customFields.map((f) => ({
    id: `cf_${f.id}`,
    label: f.name,
    group: 'custom' as const,
    dataType: f.data_type,
  }));
  return [...CORE_COLUMN_DEFS, ...custom];
}

// A column id's built-in default visibility (before any user override).
export function isDefaultVisible(id: string): boolean {
  return DEFAULT_VISIBLE_CORE.has(id);
}

// Effective visibility: an explicit override wins; otherwise the default. This
// mirrors the `?? true/false` convention the checkboxes and counter rely on, so
// the persisted map only ever needs to store deliberate deviations.
export function isColumnVisible(
  visibility: ColumnVisibility,
  id: string,
): boolean {
  const override = visibility[id];
  return override === undefined ? isDefaultVisible(id) : override;
}

// Ordered list of ids currently visible, for the table and for export.
export function getVisibleColumnIds(
  defs: ColumnDefMeta[],
  visibility: ColumnVisibility,
): string[] {
  return defs.filter((d) => isColumnVisible(visibility, d.id)).map((d) => d.id);
}
