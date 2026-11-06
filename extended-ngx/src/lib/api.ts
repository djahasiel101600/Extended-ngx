import axios, { type AxiosInstance, AxiosError } from 'axios';
import { toast } from 'sonner';
import type { 
  Document, 
  CustomField, 
  DocumentType, 
  Tag,
  PaginatedResponse,
  DocumentFilters,
  UiSettingsResponse,
  User
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;
  // Caches the last tag-exclusion result set so paging through a client-side
  // filtered view doesn't re-fetch every document on each page change.
  private tagExcludeCache: { key: string; docs: Document[] } | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Load token from localStorage on init
    const storedToken = localStorage.getItem('paperless_token');
    if (storedToken) {
      this.setToken(storedToken);
    }

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearToken();
          toast.error('Session expired. Please log in again.', { description: 'Your session has expired or is invalid.' });
          window.location.href = '/login';
        } else if (error.response?.status === 403) {
          toast.error('Access denied.', { description: 'You do not have permission to perform this action.' });
        } else if (error.response?.status === 500) {
          toast.error('Server error.', { description: 'An unexpected error occurred. Please try again later.' });
        } else if (error.message === 'Network Error') {
          toast.error('Network error.', { description: 'Unable to connect to the server.' });
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.token = token;
    this.client.defaults.headers.common['Authorization'] = `Token ${token}`;
    localStorage.setItem('paperless_token', token);
  }

  clearToken() {
    this.token = null;
    delete this.client.defaults.headers.common['Authorization'];
    localStorage.removeItem('paperless_token');
  }

  getToken(): string | null {
    return this.token;
  }

  // Auth endpoints
  async login(username: string, password: string): Promise<{ token: string }> {
    // Use Basic Auth for token request to bypass CSRF
    const credentials = btoa(`${username}:${password}`);
    const response = await this.client.post('/token/', {}, {
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    });
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const user = await this.fetchCurrentUser();
    if (!user) {
      throw new Error('Unable to resolve the authenticated user from any API endpoint.');
    }
    return user;
  }

  // Resolve the authenticated user, tolerating Paperless-ngx versions that do not
  // accept token auth on /me/ (it 302-redirects to the HTML login page there).
  // Returns null when the identity cannot be determined for the current token.
  async fetchCurrentUser(): Promise<User | null> {
    // 1. Session-auth deployments expose the profile on /me/.
    const me = await this.requestJson<User>('/me/');
    if (me && typeof me.username === 'string') {
      return me;
    }

    // 2. Token-auth deployments expose the *current* user on /ui_settings/.
    const uiSettings = await this.requestJson<UiSettingsResponse>('/ui_settings/');
    if (uiSettings?.user && typeof uiSettings.user.username === 'string') {
      const partial = uiSettings.user;
      // /ui_settings/ omits email, so enrich from the users list when reachable.
      const email = await this.fetchEmailForUserId(partial.id);
      return {
        id: partial.id,
        username: partial.username,
        email,
        first_name: partial.first_name ?? '',
        last_name: partial.last_name ?? '',
        is_superuser: partial.is_superuser ?? false,
      };
    }

    // 3. Last resort: /api/me/ redirected to HTML, but the users list may still
    //    be readable for this token.
    const users = await this.requestJson<PaginatedResponse<User>>('/users/?page_size=1');
    const first = Array.isArray(users?.results) ? users.results[0] : undefined;
    return first ?? null;
  }

  // Look up a user's email from /users/, matching on id. Returns '' when the
  // endpoint is unavailable (non-superuser tokens get 403 there) or the id is
  // not present in the fetched page.
  private async fetchEmailForUserId(userId: number): Promise<string> {
    try {
      const users = await this.requestJson<PaginatedResponse<Pick<User, 'id' | 'email'>>>('/users/?page_size=100');
      const match = users?.results?.find((u) => u.id === userId);
      return match?.email ?? '';
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Could not resolve email for user id', userId, error);
      return '';
    }
  }

  // GET that only accepts a JSON payload. Redirected HTML responses (login
  // pages served for token-unsupported endpoints) are treated as a miss rather
  // than an error, so callers can fall through to the next strategy.
  // A 401 is re-thrown so the response interceptor can clear the session.
  private async requestJson<T>(path: string): Promise<T | null> {
    try {
      const response = await this.client.get(path);
      const data = response.data as unknown;
      const contentType = String(response.headers?.['content-type'] ?? '');

      if (data && typeof data === 'object') {
        return data as T;
      }
      if (contentType.includes('json')) {
        // Some deployments return a JSON string body; try to parse it.
        try {
          const parsed = JSON.parse(String(data));
          return parsed && typeof parsed === 'object' ? (parsed as T) : null;
        } catch {
          return null;
        }
      }
      return null;
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      if (status === 401) {
        throw error;
      }
      // eslint-disable-next-line no-console
      console.warn(`Request for ${path} did not return usable JSON.`, error);
      return null;
    }
  }

  // Documents
  async getDocuments(filters: DocumentFilters = {}): Promise<PaginatedResponse<Document>> {
    // This backend does not honor any negated tag filter param, so tag
    // exclusion is applied client-side over the non-tag-filtered results.
    if (filters.excludeTagIds && filters.excludeTagIds.length > 0) {
      const kept = await this.filterDocumentsExcludingTags(filters);
      const page = filters.page ?? 1;
      const size = filters.page_size ?? 25;
      const start = (page - 1) * size;
      return {
        count: kept.length,
        next: null,
        previous: null,
        results: kept.slice(start, start + size),
      };
    }

    const params = new URLSearchParams();
    
    if (filters.query) {
      params.append('query', filters.query);
    }
    if (filters.document_type__id) {
      params.append('document_type__id', filters.document_type__id.toString());
    }
    if (filters.created__date__gte) {
      params.append('created__date__gte', filters.created__date__gte);
    }
    if (filters.created__date__lte) {
      params.append('created__date__lte', filters.created__date__lte);
    }
    if (filters.custom_field_query) {
      params.append('custom_field_query', filters.custom_field_query);
    }
    if (filters.tags__id__all) {
      params.append('tags__id__all', filters.tags__id__all);
    }
    if (filters.tags__id__in) {
      params.append('tags__id__in', filters.tags__id__in);
    }
    if (filters.page) {
      params.append('page', filters.page.toString());
    }
    if (filters.page_size) {
      params.append('page_size', filters.page_size.toString());
    }

    const response = await this.client.get(`/documents/?${params.toString()}`);
    return response.data;
  }

  async getAllDocuments(filters: DocumentFilters = {}): Promise<Document[]> {
    // Exclusion needs the full non-tag-filtered set to subtract from, so it
    // bypasses the page-by-page loop below.
    if (filters.excludeTagIds && filters.excludeTagIds.length > 0) {
      return this.filterDocumentsExcludingTags(filters);
    }

    const allDocuments: Document[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getDocuments({ ...filters, page, page_size: 100 });
      allDocuments.push(...response.results);
      hasMore = response.next !== null;
      page++;
    }

    return allDocuments;
  }

  // Fetch every document matching the NON-tag filters, then drop those that
  // carry the selected tags. 'any' removes docs with at least one selected
  // tag; 'all' removes only docs that carry every selected tag. Uses the
  // document's `tags` array (returned by the list endpoint) since the API
  // offers no server-side exclusion param. Results are cached by filter key.
  private async filterDocumentsExcludingTags(filters: DocumentFilters): Promise<Document[]> {
    const base: DocumentFilters = {
      query: filters.query,
      document_type__id: filters.document_type__id,
      created__date__gte: filters.created__date__gte,
      created__date__lte: filters.created__date__lte,
      custom_field_query: filters.custom_field_query,
    };
    const ids = filters.excludeTagIds ?? [];
    const mode = filters.excludeTagMatch ?? 'any';
    const key = JSON.stringify({ base, ids, mode });

    if (this.tagExcludeCache && this.tagExcludeCache.key === key) {
      return this.tagExcludeCache.docs;
    }

    // `base` carries no tag params, so getAllDocuments takes the normal path.
    const all = await this.getAllDocuments(base);
    const kept = all.filter((d) => {
      const docTags = d.tags ?? [];
      return mode === 'all'
        ? !ids.every((id) => docTags.includes(id))
        : !ids.some((id) => docTags.includes(id));
    });

    this.tagExcludeCache = { key, docs: kept };
    return kept;
  }

  async getDocument(id: number): Promise<Document> {
    const response = await this.client.get(`/documents/${id}/`);
    return response.data;
  }

  async getDocumentPreview(id: number): Promise<string> {
    const response = await this.client.get(`/documents/${id}/preview/`, {
      responseType: 'blob'
    });
    return URL.createObjectURL(response.data);
  }

  async getDocumentThumb(id: number): Promise<string> {
    const response = await this.client.get(`/documents/${id}/thumb/`, {
      responseType: 'blob'
    });
    return URL.createObjectURL(response.data);
  }

  async downloadDocument(id: number): Promise<Blob> {
    const response = await this.client.get(`/documents/${id}/download/`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Custom Fields
  async getCustomFields(): Promise<CustomField[]> {
    return this.fetchAllPaginated<CustomField>('/custom_fields/');
  }

  // Document Types
  async getDocumentTypes(): Promise<DocumentType[]> {
    return this.fetchAllPaginated<DocumentType>('/document_types/');
  }

  // Tags
  async getTags(): Promise<Tag[]> {
    return this.fetchAllPaginated<Tag>('/tags/');
  }

  // Helper to fetch paginated endpoints that either return a plain array
  // or a Django REST Framework style paginated object with `results`/`next`.
  private async fetchAllPaginated<T>(endpoint: string, pageSize = 100): Promise<T[]> {
    const all: T[] = [];
    let page = 1;

    while (true) {
      const response = await this.client.get(`${endpoint}?page=${page}&page_size=${pageSize}`);
      const data = response.data;

      // If API returns a plain array (not paginated), return it directly
      if (Array.isArray(data)) {
        return data as T[];
      }

      // If it's a paginated DRF response
      if (data && Array.isArray(data.results)) {
        all.push(...data.results);
        // Continue while `next` is truthy (usually a URL) otherwise break
        if (!data.next) break;
        page++;
        continue;
      }

      // Unexpected shape: log and return whatever we've collected so far.
      // This avoids returning an object with unexpected structure.
      // eslint-disable-next-line no-console
      console.warn(`Unexpected response shape for ${endpoint}`, data);
      return all;
    }

    return all;
  }

  // Build custom field query
  buildCustomFieldQuery(filters: Array<[string, string, unknown]>): string {
    if (filters.length === 0) return '';
    
    if (filters.length === 1) {
      return JSON.stringify(filters[0]);
    }
    
    return JSON.stringify(['AND', filters]);
  }
}

export const api = new ApiService();
export default api;
