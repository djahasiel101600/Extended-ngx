// Document Types
export interface Document {
  id: number;
  title: string;
  content: string;
  created: string;
  modified: string;
  added: string;
  owner: number;
  document_type: number | null;
  correspondent: number | null;
  storage_path: number | null;
  archive_serial_number: string | null;
  original_file_name: string;
  archived_file_name: string;
  custom_fields: CustomFieldValue[];
  tags: number[];
}

export interface CustomFieldValue {
  field: number;
  value: string | number | boolean | null;
}

export interface CustomField {
  id: number;
  name: string;
  data_type: 'string' | 'url' | 'date' | 'boolean' | 'integer' | 'float' | 'monetary' | 'select';
  extra_data?: {
    select_options?: SelectOption[];
  };
}

export interface SelectOption {
  id: string;
  label: string;
}

export interface DocumentType {
  id: number;
  name: string;
  slug: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
}

// Paperless-ngx Tag. `color` is a hex string (e.g. "#a6b899") used to render
// the swatch; documents reference tags by id via Document.tags.
export interface Tag {
  id: number;
  name: string;
  color: string;
  text_color?: string;
  match?: string;
  matching_algorithm?: number;
  is_insensitive?: boolean;
}

export interface Correspondent {
  id: number;
  name: string;
  slug: string;
}

// API Response Types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Filter Types
export interface DocumentFilters {
  query?: string;
  document_type__id?: number;
  created__date__gte?: string;
  created__date__lte?: string;
  custom_field_query?: string;
  // Comma-joined tag id lists. `tags__id__in` matches documents with ANY of
  // the tags; `tags__id__all` matches documents that carry ALL of them.
  tags__id__in?: string;
  tags__id__all?: string;
  // Tag exclusion. The backend has no negated tag filter param, so these are
  // handled client-side by the API layer: it fetches the documents matching
  // every OTHER filter and removes those carrying the selected tags. When
  // `excludeTagIds` is set, `tags__id__in`/`tags__id__all` are ignored.
  excludeTagIds?: number[];
  excludeTagMatch?: 'any' | 'all';
  page?: number;
  page_size?: number;
}

export interface CustomFieldFilter {
  fieldId: number;
  fieldName: string;
  fieldType: string;
  // 'range' is used for numeric/date fields (min and/or max). 'icontains' for
  // text/url. 'exact' for select/boolean single-choice.
  operator: 'exact' | 'icontains' | 'range';
  // For exact/icontains: the single value. For range: the lower (gte) bound.
  value: string | number | boolean | null;
  // Upper (lte) bound — only meaningful when operator === 'range'.
  valueUpper?: string | number | null;
}

// Auth Types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_superuser: boolean;
}

// GET /api/ui_settings/ — the `user` payload identifies the token's owner.
// Token-auth deployments do not serve the profile on /me/, so this is the
// Paperless-ngx-compatible source for the current username.
export interface UiSettingsResponse {
  user: {
    id: number;
    username: string;
    is_staff?: boolean;
    is_superuser?: boolean;
    first_name?: string;
    last_name?: string;
    groups?: number[];
  };
  settings?: unknown;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
}

// UI State Types
export interface ColumnVisibility {
  [key: string]: boolean;
}

export interface DatePreset {
  label: string;
  value: string;
  getRange: () => { from: Date; to: Date } | null;
}

// Column metadata — a single source of truth shared by the table, the column
// manager, and export so they never disagree about which columns exist.
export type ColumnGroup = 'core' | 'custom';

export interface ColumnDefMeta {
  id: string;
  label: string;
  group: ColumnGroup;
  dataType?: CustomField['data_type'];
}

// Structured, serializable snapshot of everything the Filters UI holds. This —
// not the flattened DocumentFilters — is what a preset stores, so a saved
// preset can be restored back into the exact controls the user configured.
export interface FilterState {
  query: string;
  documentTypeId: string; // 'all' | String(id)
  datePreset: string;
  dateFrom?: string; // yyyy-MM-dd
  dateTo?: string; // yyyy-MM-dd
  customFieldFilters: CustomFieldFilter[];
  tagIds: number[];
  tagMatch: 'any' | 'all';
  // When true, invert the tag selection: show documents WITHOUT the selected
  // tags instead of documents WITH them.
  tagExclude: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  state: FilterState;
  createdAt: string;
}

// Export configuration surfaced by the ExportDialog.
export type ExportFormat = 'csv' | 'json' | 'pdf';
export type ExportScope = 'selected' | 'page' | 'all';

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  columnIds: string[];
  includeContent: boolean;
}
