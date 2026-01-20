import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { LogOut, FileText, RefreshCw } from 'lucide-react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import React, { Suspense } from 'react';
const UserProfilePanel = React.lazy(() => import('@/components/UserProfilePanel').then(module => ({ default: module.UserProfilePanel })));
const DocumentPreview = React.lazy(() => import('@/components/DocumentPreview').then(module => ({ default: module.DocumentPreview })));
import { Filters } from '@/components/Filters';
import { DocumentTable } from '@/components/DocumentTable';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Document, CustomField, DocumentType, DocumentFilters } from '@/types';

export function DashboardPage() {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, logout } = useAuth();
  
  // Data state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Pagination state
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Current filters
  const [currentFilters, setCurrentFilters] = useState<DocumentFilters>({});

  // Load metadata on mount
  useEffect(() => {
    loadMetadata();
  }, []);

  // Load documents when filters or pagination changes
  useEffect(() => {
    loadDocuments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilters, currentPage, pageSize]);

  const loadMetadata = async () => {
    try {
      const [fields, types] = await Promise.all([
        api.getCustomFields(),
        api.getDocumentTypes(),
      ]);
      setCustomFields(fields);
      setDocumentTypes(types);
    } catch (error) {
      console.error('Failed to load metadata:', error);
      toast.error('Failed to load metadata. Please refresh the page.');
    }
  };

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      // Log requested filters and pagination for debugging
      // eslint-disable-next-line no-console
      console.debug('Loading documents with filters:', currentFilters, 'page:', currentPage, 'page_size:', pageSize);

      const response = await api.getDocuments({
        ...currentFilters,
        page: currentPage,
        page_size: pageSize,
      });

      // Debug response shape
      // eslint-disable-next-line no-console
      console.debug('Documents response:', { count: response.count, resultsLength: response.results.length });

      // If server reports there are documents (count>0) but the current page returned no results,
      // this usually means the requested page is out of range (e.g. page was too high).
      // In that case, automatically fetch page 1 and update the paginator to avoid showing "No documents found".
      if (response.count > 0 && response.results.length === 0 && currentPage > 1) {
        // eslint-disable-next-line no-console
        console.warn('Requested page out of range. Resetting to page 1 and reloading documents.');
        const firstPage = await api.getDocuments({ ...currentFilters, page: 1, page_size: pageSize });
        setDocuments(firstPage.results);
        setTotalCount(firstPage.count);
        setCurrentPage(1);
      } else {
        setDocuments(response.results);
        setTotalCount(response.count);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load documents. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFiltersChange = useCallback((filters: DocumentFilters) => {
    setCurrentFilters(filters);
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when page size changes
  };

  const handleRowClick = (document: Document) => {
    setSelectedDocument(document);
    setIsPreviewOpen(true);
  };

  const handleRefresh = () => {
    loadMetadata();
    loadDocuments();
  };

  // Accepts optional selectedDocs for batch export
  const handleExportCsv = async (selectedDocs?: Document[]) => {
    setIsExporting(true);
    try {
      let exportDocs: Document[] = [];
      if (selectedDocs && selectedDocs.length > 0) {
        exportDocs = selectedDocs;
      } else {
        // Safety check for bulk export
        if (totalCount > 2000) {
          toast.error('Export limit exceeded.', { 
            description: `Cannot export ${totalCount} documents at once. Please filter your results to under 2000 documents.` 
          });
          setIsExporting(false);
          return;
        }

        // Fetch ALL documents matching current filters (not just current page)
        toast.info('Fetching all documents for export...');
        exportDocs = await api.getAllDocuments(currentFilters);
      }

      if (exportDocs.length === 0) {
        toast.warning('No documents to export.');
        return;
      }

      // Build CSV headers
      const baseHeaders = ['ID', 'Title', 'Content', 'Created', 'Owner', 'Document Type'];
      const customFieldHeaders = customFields.map((f) => f.name);
      const headers = [...baseHeaders, ...customFieldHeaders];

      // Build CSV rows
      const rows = exportDocs.map((doc) => {
        const docType = documentTypes.find((t) => t.id === doc.document_type);
        const baseValues = [
          doc.id.toString(),
          escapeCSV(doc.title),
          escapeCSV(doc.content || ''),
          doc.created,
          doc.owner.toString(),
          docType?.name || '',
        ];

        const customFieldValues = customFields.map((field) => {
          const cfValue = doc.custom_fields.find((cf) => cf.field === field.id);
          if (!cfValue || cfValue.value === null || cfValue.value === undefined) return '';

          if (field.data_type === 'select') {
            const options = field.extra_data?.select_options || [];
            const option = options.find((o) => o.id === cfValue.value);
            return escapeCSV(option?.label || String(cfValue.value));
          }

          if (field.data_type === 'boolean') {
            return cfValue.value ? 'Yes' : 'No';
          }

          return escapeCSV(String(cfValue.value));
        });

        return [...baseValues, ...customFieldValues];
      });

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `paperless-export-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Successfully exported ${exportDocs.length} documents.`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export documents. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60" role="banner" aria-label="App Header">
        <div className="container flex flex-col md:flex-row h-auto md:h-14 items-center justify-between px-4 py-2 gap-2">
          <div className="flex items-center gap-2" aria-label="App Branding">
            <FileText className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="text-lg font-semibold" tabIndex={0}>Paperless-ngx Viewer</h1>
          </div>
          <div className="flex items-center gap-2" aria-label="Header Controls">
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading} aria-label="Refresh documents" title="Refresh documents">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
            <ThemeToggle />
            {user && (
              <>
                <span className="text-sm text-muted-foreground hidden sm:inline" aria-label="Username">
                  {user.username}
                </span>
                <Button variant="outline" size="sm" onClick={() => setIsProfileOpen(true)} aria-label="Profile">
                  <User className="h-4 w-4 mr-2" aria-hidden="true" />
                  Profile
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={logout} aria-label="Logout">
              <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
              Logout
            </Button>
          </div>
        </div>
      </header>
  {/* User Profile Panel */}
      <Suspense fallback={<div className="p-8 text-center"><span>Loading profile...</span></div>}>
        <UserProfilePanel isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      </Suspense>

      {/* Main Content */}
      <main className="container px-4 py-6 space-y-6" role="main">
        {/* Filters */}
        <Filters
          customFields={customFields}
          documentTypes={documentTypes}
          onFiltersChange={handleFiltersChange}
          isLoading={isLoading}
          disableRealTimeUpdates={totalCount > 1200}
        />

        {/* Document Table */}
        <DocumentTable
          documents={documents}
          customFields={customFields}
          documentTypes={documentTypes}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          isLoading={isLoading}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onRowClick={handleRowClick}
          onExportCsv={handleExportCsv}
          isExporting={isExporting}
        />
      </main>

      {/* Document Preview Panel */}
        {isLoading ? (
          <div className="fixed inset-0 flex items-center justify-center bg-background/80 z-50" aria-busy="true">
            <div className="p-8 rounded-lg bg-card shadow-lg flex flex-col items-center gap-4">
              <FileText className="h-12 w-12 animate-pulse text-muted-foreground" />
              <span className="text-lg text-muted-foreground">Loading documents...</span>
            </div>
          </div>
        ) : (
          <Suspense fallback={<div className="p-8 text-center"><span>Loading preview...</span></div>}>
            <DocumentPreview
              doc={selectedDocument}
              customFields={customFields}
              documentTypes={documentTypes}
              isOpen={isPreviewOpen}
              onClose={() => setIsPreviewOpen(false)}
            />
          </Suspense>
        )}
    </div>
  );
}
