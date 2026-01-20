import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ColumnVisibilityToggle } from './ColumnVisibilityToggle';
import type { Document, CustomField, DocumentType, ColumnVisibility } from '@/types';

// Helper component for sortable headers
const SortableHeader = ({ 
  column, 
  children 
}: { 
  column: any, 
  children: React.ReactNode 
}) => {
  const SortIcon = () => {
    const sortState = column.getIsSorted();
    if (sortState === 'asc') return <ArrowUp className="ml-2 h-3 w-3 shrink-0" />;
    if (sortState === 'desc') return <ArrowDown className="ml-2 h-3 w-3 shrink-0" />;
    return <ArrowUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />;
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 font-medium whitespace-nowrap justify-start hover:bg-accent hover:text-accent-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      <span className="truncate">{children}</span>
      <SortIcon />
    </Button>
  );
};

interface DocumentTableProps {
  documents: Document[];
  customFields: CustomField[];
  documentTypes: DocumentType[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRowClick: (document: Document) => void;
  onExportCsv: (selectedDocs?: Document[]) => void;
  isExporting: boolean;
}

export function DocumentTable({
  documents,
  customFields,
  documentTypes,
  totalCount,
  currentPage,
  pageSize,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  onExportCsv,
  isExporting,
}: DocumentTableProps) {
  // Debug logging
  useEffect(() => {
    console.log('Documents received:', documents);
    console.log('Documents length:', documents?.length);
    console.log('Custom fields:', customFields);
    console.log('Document types:', documentTypes);
    if (documents && documents.length > 0) {
      console.log('First document keys:', Object.keys(documents[0]));
      console.log('First document sample:', documents[0]);
    }
  }, [documents, customFields, documentTypes]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  // Row selection logic
  const isAllSelected = useMemo(() => {
    if (!documents.length) return false;
    return documents.every((doc) => selectedIds.has(doc.id));
  }, [documents, selectedIds]);

  const isIndeterminate = useMemo(() => {
    if (!documents.length) return false;
    const selectedCount = documents.filter((doc) => selectedIds.has(doc.id)).length;
    return selectedCount > 0 && selectedCount < documents.length;
  }, [documents, selectedIds]);

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((doc) => doc.id)));
    }
  }, [isAllSelected, documents]);

  const toggleOne = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Event handlers
  const handlePageChange = useCallback((page: number) => onPageChange(page), [onPageChange]);
  const handlePageSizeChange = useCallback((size: number) => onPageSizeChange(size), [onPageSizeChange]);
  const handleRowClick = useCallback((doc: Document) => onRowClick(doc), [onRowClick]);
  
  const handleExportSelected = useCallback(() => {
    if (selectedIds.size > 0) {
      const selectedDocs = documents.filter((doc) => selectedIds.has(doc.id));
      onExportCsv(selectedDocs);
    } else {
      onExportCsv();
    }
  }, [onExportCsv, selectedIds, documents]);

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const defaultVisibility: VisibilityState = {
      id: true,
      title: true,
      content: false,
      created: true,
      owner: false,
      document_type: true,
    };
    
    customFields.slice(0, 3).forEach((f) => {
      defaultVisibility[`cf_${f.id}`] = true;
    });
    customFields.slice(3).forEach((f) => {
      defaultVisibility[`cf_${f.id}`] = false;
    });
    
    return defaultVisibility;
  });

  // Helper functions
  const getDocumentTypeName = useCallback((typeId: number | null) => {
    if (!typeId) return '';
    const docType = documentTypes.find((t) => t.id === typeId);
    return docType?.name || '';
  }, [documentTypes]);

  const getCustomFieldValue = useCallback((doc: Document, fieldId: number): string => {
    const cfValue = doc.custom_fields.find((cf) => cf.field === fieldId);
    if (!cfValue || cfValue.value === null || cfValue.value === undefined) return '';

    const fieldMeta = customFields.find((f) => f.id === fieldId);
    if (!fieldMeta) return String(cfValue.value);

    switch (fieldMeta.data_type) {
      case 'select': {
        const options = fieldMeta.extra_data?.select_options || [];
        const option = options.find((o) => o.id == cfValue.value);
        return option?.label || String(cfValue.value);
      }
      
      case 'boolean':
        return cfValue.value ? 'Yes' : 'No';
      
      case 'date':
        try {
          const dateVal = new Date(String(cfValue.value));
          return isNaN(dateVal.getTime()) ? String(cfValue.value) : format(dateVal, 'MMM dd, yyyy');
        } catch {
          return String(cfValue.value);
        }
      
      case 'monetary':
        if (cfValue.value === null || cfValue.value === undefined || cfValue.value === '') return '';
        const num = parseFloat(String(cfValue.value));
        return isNaN(num) ? String(cfValue.value) : `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      
      default:
        return String(cfValue.value);
    }
  }, [customFields]);

  // Calculate monetary totals
  const monetaryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    customFields.forEach((field) => {
      if (field.data_type === 'monetary') {
        let total = 0;
        documents.forEach((doc) => {
          const cfValue = doc.custom_fields.find((cf) => cf.field === field.id);
          if (cfValue?.value) {
            const raw = String(cfValue.value).replace(/[^\d.-]/g, '');
            const num = parseFloat(raw);
            if (!isNaN(num)) total += num;
          }
        });
        totals[field.name] = total;
      }
    });
    return totals;
  }, [documents, customFields]);

  // Build columns
  const columns = useMemo<ColumnDef<Document>[]>(() => {
    console.log('Building columns with documents length:', documents.length);
    
    const baseColumns: ColumnDef<Document>[] = [
      {
        id: 'id',
        accessorKey: 'id',
        header: ({ column }) => (
          <div className="flex items-center">
            <SortableHeader column={column}>
              ID
            </SortableHeader>
          </div>
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue('id')}</span>
        ),
        size: 80,
        minSize: 60,
        maxSize: 100,
      },
      {
        id: 'title',
        accessorKey: 'title',
        header: ({ column }) => (
          <SortableHeader column={column}>
            Title
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="max-w-md truncate font-medium" title={row.getValue('title')}>
            {row.getValue('title') || '-'}
          </div>
        ),
        size: 250,
        minSize: 150,
      },
      {
        id: 'content',
        accessorKey: 'content',
        header: 'Content',
        cell: ({ row }) => (
          <div className="max-w-xs truncate text-muted-foreground" title={row.getValue('content')}>
            {row.getValue('content') || '-'}
          </div>
        ),
        size: 200,
        minSize: 150,
      },
      {
        id: 'created',
        accessorKey: 'created',
        header: ({ column }) => (
          <SortableHeader column={column}>
            Created
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const dateStr = row.getValue('created');
          if (!dateStr) return '-';
          try {
            const date = new Date(String(dateStr));
            return isNaN(date.getTime()) ? String(dateStr) : format(date, 'MMM dd, yyyy');
          } catch {
            return String(dateStr);
          }
        },
        size: 120,
        minSize: 100,
        maxSize: 140,
      },
      {
        id: 'owner',
        accessorKey: 'owner',
        header: 'Owner',
        cell: ({ row }) => row.getValue('owner') || '-',
        size: 150,
        minSize: 100,
      },
      {
        id: 'document_type',
        accessorKey: 'document_type',
        header: 'Document Type',
        cell: ({ row }) => {
          const typeName = getDocumentTypeName(row.getValue('document_type'));
          return typeName ? (
            <Badge variant="outline" className="truncate max-w-full">
              {typeName}
            </Badge>
          ) : null;
        },
        size: 150,
        minSize: 120,
      },
    ];

    // Add custom field columns
    const customFieldColumns: ColumnDef<Document>[] = customFields.map((field) => ({
      id: `cf_${field.id}`,
      accessorFn: (row: Document) => getCustomFieldValue(row, field.id),
      header: ({ column }) => (
        <SortableHeader column={column}>
          {field.name}
        </SortableHeader>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as string;
        if (field.data_type === 'monetary') {
          return <span className="font-medium text-right block w-full">{value || '-'}</span>;
        }
        if (field.data_type === 'boolean') {
          return value === 'Yes' ? (
            <Badge variant="default">Yes</Badge>
          ) : value === 'No' ? (
            <Badge variant="secondary">No</Badge>
          ) : (
            <span>-</span>
          );
        }
        return <span className="truncate max-w-37.5 block">{value || '-'}</span>;
      },
      size: field.data_type === 'monetary' ? 120 : 150,
      minSize: 100,
    }));

    return [...baseColumns, ...customFieldColumns];
  }, [customFields, getDocumentTypeName, getCustomFieldValue, documents.length]);

  // Initialize table
  const table = useReactTable({
    data: documents,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pageSize),
  });

  // Get rows from table
  const rows = table.getRowModel().rows;
  
  // Debug table state
  useEffect(() => {
    console.log('Table rows:', rows.length);
    console.log('Table columns:', table.getAllLeafColumns().map(c => ({ id: c.id, visible: c.getIsVisible() })));
    console.log('Column visibility state:', columnVisibility);
  }, [rows.length, table, columnVisibility]);

  // Column definitions for visibility toggle
  const columnDefs = useMemo(() => [
    { id: 'id', label: 'ID' },
    { id: 'title', label: 'Title' },
    { id: 'content', label: 'Content' },
    { id: 'created', label: 'Created' },
    { id: 'owner', label: 'Owner' },
    { id: 'document_type', label: 'Document Type' },
    ...customFields.map((f) => ({ id: `cf_${f.id}`, label: f.name })),
  ], [customFields]);

  // Virtualization setup - FIXED
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: isLoading && rows.length === 0 ? 10 : rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  
  // Debug virtualization
  useEffect(() => {
    console.log('Virtual items count:', virtualItems.length);
    console.log('Virtualization total size:', totalSize);
    console.log('Parent ref exists:', !!parentRef.current);
  }, [virtualItems.length, totalSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4" aria-label="Document Table Section">
      {/* Debug info - you can remove this after testing */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm text-yellow-800">
        <div>Documents: {documents?.length || 0}</div>
        <div>Rows from table: {rows.length}</div>
        <div>Virtual items: {virtualItems.length}</div>
        <div>Total size: {totalSize}</div>
        <div>Is loading: {isLoading.toString()}</div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2" aria-label="Table Toolbar">
        <div className="flex items-center gap-2">
          <ColumnVisibilityToggle
            columns={columnDefs}
            visibility={columnVisibility as ColumnVisibility}
            onVisibilityChange={(v) => setColumnVisibility(v)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSelected}
            disabled={isExporting || documents.length === 0 || (selectedIds.size > 0 && selectedIds.size === 0)}
            aria-label={selectedIds.size > 0 ? 'Export selected documents to CSV' : 'Export all documents to CSV'}
            title={selectedIds.size > 0 ? 'Export selected documents to CSV' : 'Export all filtered documents to CSV'}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {selectedIds.size > 0 ? 'Export Selected' : 'Export All to CSV'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Table with virtualization - FIXED container */}
      <div
        className="rounded-md border overflow-auto"
        role="region"
        aria-label="Documents Table"
        ref={parentRef}
        style={{ height: 480, position: 'relative' }}
      >
        <Table 
          role="table" 
          aria-label="Documents"
          className="w-full"
        >
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} style={{ display: 'flex', width: '100%' }}>
                <TableHead 
                  role="columnheader" 
                  className="w-10 p-0"
                  style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <div className="flex items-center justify-center h-8">
                    <input
                      type="checkbox"
                      aria-label="Select all documents"
                      checked={isAllSelected}
                      ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                      onChange={toggleAll}
                      className="h-4 w-4"
                    />
                  </div>
                </TableHead>
                {headerGroup.headers.map((header) => (
                  <TableHead 
                    key={header.id} 
                    role="columnheader"
                    className="p-0"
                    style={{ 
                      width: header.getSize(),
                      minWidth: header.column.columnDef.minSize,
                      maxWidth: header.column.columnDef.maxSize,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <div className="px-3 py-2 h-8 w-full">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody role="rowgroup" style={{ height: totalSize, position: 'relative', display: 'block' }}>
            {/* Render visible rows */}
            {virtualItems.map((virtualRow) => {
              const rowIdx = virtualRow.index;
              
              // Show loading skeleton
              if (isLoading && rows.length === 0) {
                return (
                  <TableRow 
                    key={`skeleton-${rowIdx}`} 
                    style={{ 
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      height: virtualRow.size,
                      display: 'flex'
                    }}
                  >
                    <TableCell className="w-10 p-0" style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="flex items-center justify-center h-12">
                        <input type="checkbox" disabled className="h-4 w-4" />
                      </div>
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell 
                        key={`skeleton-${col.id}-${rowIdx}`} 
                        className="animate-pulse bg-muted h-12"
                        style={{ width: col.size || 150, display: 'block' }}
                      />
                    ))}
                  </TableRow>
                );
              }
              
              // Check if we have data for this index
              if (rowIdx >= rows.length) return null;
              
              const row = rows[rowIdx];
              if (!row) return null;
              
              const isChecked = selectedIds.has(row.original.id);
              
              return (
                <TableRow
                  key={row.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    height: virtualRow.size,
                    display: 'flex'
                  }}
                  onClick={() => handleRowClick(row.original)}
                  className={
                    'cursor-pointer hover:bg-muted/50' +
                    (isChecked ? ' bg-accent/40' : '')
                  }
                  tabIndex={0}
                  role="row"
                  aria-label={`Document ${row.original.title}`}
                >
                  <TableCell className="w-10 p-0" style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="flex items-center justify-center h-12">
                      <input
                        type="checkbox"
                        aria-label={`Select document ${row.original.title}`}
                        checked={isChecked}
                        onChange={e => { e.stopPropagation(); toggleOne(row.original.id); }}
                        onClick={e => e.stopPropagation()}
                        className="h-4 w-4"
                      />
                    </div>
                  </TableCell>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id} 
                      role="cell"
                      className="py-2"
                      style={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.columnDef.minSize,
                        maxWidth: cell.column.columnDef.maxSize,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}

            {/* Empty state */}
            {!isLoading && rows.length === 0 && (
              <TableRow style={{ display: 'flex', width: '100%' }}>
                <TableCell
                  className="h-24 text-center flex items-center justify-center"
                  role="cell"
                  style={{ width: '100%' }}
                >
                  {totalCount > 0 ? 'No documents on this page.' : 'No documents found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Monetary Totals */}
      {Object.keys(monetaryTotals).length > 0 && (
        <div className="flex flex-wrap gap-4 p-4 bg-muted rounded-lg" aria-label="Monetary Totals">
          {Object.entries(monetaryTotals).map(([fieldName, total]) => (
            <div key={fieldName} className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{fieldName} Total:</span>
              <Badge variant="secondary" className="text-base font-semibold">
                ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-col md:flex-row items-center justify-between px-2 gap-2" aria-label="Pagination Controls">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)} to{' '}
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount} documents
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => handlePageSizeChange(parseInt(value))}
              aria-label="Rows per page"
            >
              <SelectTrigger className="w-17.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1 || isLoading}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage >= totalPages || isLoading}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}