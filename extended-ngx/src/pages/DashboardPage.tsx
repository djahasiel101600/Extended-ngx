import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React, { Suspense } from 'react';
const DocumentPreview = React.lazy(() => import('@/components/DocumentPreview').then(m => ({ default: m.DocumentPreview })));
import { Filters } from '@/components/Filters';
import { DocumentTable } from '@/components/DocumentTable';
import { ExportDialog } from '@/components/ExportDialog';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/lib/storage';
import { buildColumnDefs, getVisibleColumnIds } from '@/lib/columns';
import type {
  Document,
  CustomField,
  DocumentType,
  Tag,
  DocumentFilters,
  ColumnVisibility,
  ExportOptions,
} from '@/types';

export function DashboardPage() {
  const { user } = useAuth();

  // Data
  const [documents, setDocuments] = useState<Document[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // UI
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Pagination
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [currentFilters, setCurrentFilters] = useState<DocumentFilters>({});

  // Persisted column visibility (sparse overrides; defaults are core-only).
  const [columnVisibility, setColumnVisibility, resetColumnVisibility] =
    useLocalStorage<ColumnVisibility>(STORAGE_KEYS.columnVisibility, {});

  const defs = useMemo(() => buildColumnDefs(customFields), [customFields]);
  const visibleColumnIds = useMemo(() => getVisibleColumnIds(defs, columnVisibility), [defs, columnVisibility]);

  useEffect(() => {
    loadMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilters, currentPage, pageSize]);

  // Keyboard: Ctrl/Cmd+E toggles the export dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsExportOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loadMetadata = async () => {
    try {
      const [fields, types, tagList] = await Promise.all([
        api.getCustomFields(),
        api.getDocumentTypes(),
        api.getTags(),
      ]);
      setCustomFields(fields);
      setDocumentTypes(types);
      setTags(tagList);
    } catch (error) {
      console.error('Failed to load metadata:', error);
      toast.error('Failed to load metadata. Please refresh the page.');
    }
  };

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await api.getDocuments({ ...currentFilters, page: currentPage, page_size: pageSize });
      // Requested page fell out of range after filtering: snap back to page 1.
      if (response.count > 0 && response.results.length === 0 && currentPage > 1) {
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
    setCurrentPage(1);
  }, []);

  const handleRefresh = () => {
    loadMetadata();
    loadDocuments();
  };

  const handleResetColumns = () => {
    resetColumnVisibility();
    toast.info('Columns reset to the default view.');
  };

  const summarizeFilters = useCallback((f: DocumentFilters): string => {
    const parts: string[] = [];
    if (f.query) parts.push(`search “${f.query}”`);
    if (f.document_type__id) {
      const t = documentTypes.find((dt) => dt.id === f.document_type__id);
      parts.push(`type: ${t?.name ?? f.document_type__id}`);
    }
    if (f.created__date__gte || f.created__date__lte) {
      parts.push(`created ${f.created__date__gte ?? '…'} → ${f.created__date__lte ?? '…'}`);
    }
    if (f.custom_field_query) parts.push('custom field filters');
    if (f.excludeTagIds?.length) {
      const names = f.excludeTagIds.map((id) => tags.find((tg) => tg.id === id)?.name ?? String(id)).join(', ');
      parts.push(`without tags: ${names}`);
    } else if (f.tags__id__in || f.tags__id__all) {
      const ids = (f.tags__id__in ?? f.tags__id__all ?? '').split(',').filter(Boolean).map(Number);
      const names = ids.map((id) => tags.find((tg) => tg.id === id)?.name ?? String(id)).join(', ');
      parts.push(`tags: ${names}`);
    }
    return parts.length ? parts.join('  ·  ') : 'none';
  }, [documentTypes, tags]);

  const handleExport = async (opts: ExportOptions) => {
    setIsExporting(true);
    try {
      let docs: Document[];
      if (opts.scope === 'selected') {
        docs = documents.filter((d) => selectedIds.has(d.id));
      } else if (opts.scope === 'page') {
        docs = documents;
      } else {
        if (totalCount > 2000) {
          toast.error('Export limit exceeded.', {
            description: `Filter to under 2,000 documents (currently ${totalCount.toLocaleString()}).`,
          });
          return;
        }
        toast.info('Fetching all documents for export…');
        docs = await api.getAllDocuments(currentFilters);
      }
      if (docs.length === 0) {
        toast.warning('No documents to export.');
        return;
      }
      // Pull in the (heavy, PDF-capable) export module only when the user
      // actually exports, keeping it out of the initial bundle.
      const { runExport } = await import('@/lib/export');
      runExport(docs, opts, {
        customFields,
        documentTypes,
        defs,
        filterSummary: summarizeFilters(currentFilters),
      });
      toast.success(`Exported ${docs.length} documents.`);
      setIsExportOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export documents. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">
            {user ? `Signed in as ${user.username}` : 'Browse, filter and export your archive'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading} aria-label="Refresh documents">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsExportOpen(true)} disabled={documents.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Filters
        customFields={customFields}
        documentTypes={documentTypes}
        tags={tags}
        onFiltersChange={handleFiltersChange}
        isLoading={isLoading}
        disableRealTimeUpdates={totalCount > 1200}
        resultCount={documents.length}
        totalCount={totalCount}
      />

      <DocumentTable
        documents={documents}
        customFields={customFields}
        documentTypes={documentTypes}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={pageSize}
        isLoading={isLoading}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        onRowClick={(doc) => { setSelectedDocument(doc); setIsPreviewOpen(true); }}
        onExport={() => setIsExportOpen(true)}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        onResetColumns={handleResetColumns}
      />

      <Suspense fallback={<div className="p-8 text-center"><span>Loading preview…</span></div>}>
        <DocumentPreview
          doc={selectedDocument}
          customFields={customFields}
          documentTypes={documentTypes}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
        />
      </Suspense>

      <ExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        defs={defs}
        visibleColumnIds={visibleColumnIds}
        selectedCount={selectedIds.size}
        currentPageCount={documents.length}
        totalCount={totalCount}
        isExporting={isExporting}
        onSubmit={handleExport}
      />
    </div>
  );
}
