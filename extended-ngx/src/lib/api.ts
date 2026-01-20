import axios, { type AxiosInstance, AxiosError } from 'axios';
import { toast } from 'sonner';
import type { 
  Document, 
  CustomField, 
  DocumentType, 
  PaginatedResponse,
  DocumentFilters,
  User
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

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
    const response = await this.client.get('/me/');
    return response.data;
  }

  // Documents
  async getDocuments(filters: DocumentFilters = {}): Promise<PaginatedResponse<Document>> {
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
