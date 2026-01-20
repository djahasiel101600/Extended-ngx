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
  page?: number;
  page_size?: number;
}

export interface CustomFieldFilter {
  fieldId: number;
  fieldName: string;
  fieldType: string;
  value: string | number | boolean | [string, string] | null;
  operator: 'exact' | 'icontains' | 'gte' | 'lte' | 'range';
}

// Auth Types
export interface User {
  id: number;
  username: string;
  email: string;
  is_superuser: boolean;
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
