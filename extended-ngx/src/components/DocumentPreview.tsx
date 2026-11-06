import { useState } from 'react';
import { format } from 'date-fns';
import { Download, FileText, Calendar, User, Tag, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { api } from '@/lib/api';
import type { Document as DocType, CustomField, DocumentType } from '@/types';
import {toast} from 'sonner'

interface DocumentPreviewProps {
  doc: DocType | null;
  customFields: CustomField[];
  documentTypes: DocumentType[];
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentPreview({
  doc,
  customFields,
  documentTypes,
  isOpen,
  onClose,
}: DocumentPreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Use Sonner for toast notifications
  // @ts-ignore

  const loadPreview = async () => {
    if (!doc || previewUrl) return;
    setIsLoadingPreview(true);
    try {
      const url = await api.getDocumentPreview(doc.id);
      setPreviewUrl(url);
    } catch (error) {
      toast.error('Failed to load preview.', { description: 'Could not load document preview.' });
      console.error('Failed to load preview:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownload = async () => {
    if (!doc) return;
    setIsDownloading(true);
    try {
      const blob = await api.downloadDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_file_name || `document-${doc.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Download started.', { description: 'Your document is downloading.' });
    } catch (error) {
      toast.error('Failed to download.', { description: 'Could not download document.' });
      console.error('Failed to download:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const getDocumentTypeName = (typeId: number | null) => {
    if (!typeId) return 'Unknown';
    const docType = documentTypes.find((t) => t.id === typeId);
    return docType?.name || 'Unknown';
  };

  const getCustomFieldValue = (fieldId: number) => {
    const cfValue = doc?.custom_fields.find((cf) => cf.field === fieldId);
    if (!cfValue) return null;

    const fieldMeta = customFields.find((f) => f.id === fieldId);
    if (!fieldMeta) return cfValue.value;

    if (fieldMeta.data_type === 'select') {
      const options = fieldMeta.extra_data?.select_options || [];
      // Loose equality check
      // eslint-disable-next-line eqeqeq
      const option = options.find((o) => o.id == cfValue.value);
      return option?.label || cfValue.value;
    }

    if (fieldMeta.data_type === 'boolean') {
      return cfValue.value ? 'Yes' : 'No';
    }

    if (fieldMeta.data_type === 'date' && cfValue.value) {
      try {
        const dateVal = new Date(String(cfValue.value));
        if (isNaN(dateVal.getTime())) return String(cfValue.value);
        return format(dateVal, 'MMM dd, yyyy');
      } catch {
        return String(cfValue.value);
      }
    }

    if (fieldMeta.data_type === 'monetary' && cfValue.value !== null && cfValue.value !== undefined && cfValue.value !== '') {
      const num = parseFloat(String(cfValue.value));
      if (isNaN(num)) return String(cfValue.value);
      return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }

    return String(cfValue.value);
  };

  if (!doc) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl p-4" onOpenAutoFocus={loadPreview} role="dialog" aria-modal="true" aria-label="Document Preview" aria-describedby={undefined}>
        <SheetHeader>
          <div className="flex items-start justify-between">
            <SheetTitle className="text-lg font-semibold pr-8 line-clamp-2" tabIndex={0} aria-label="Document Title">
              {doc.title}
            </SheetTitle>
          </div>
        </SheetHeader>
        {isLoadingPreview ? (
          <div className="flex flex-col items-center justify-center h-64" aria-busy="true">
            <FileText className="h-12 w-12 animate-pulse text-muted-foreground mb-4" />
            <span className="text-lg text-muted-foreground">Loading preview...</span>
          </div>
        ) : (
          <ScrollArea className="h-[60vh]" role="region" aria-label="Document Details">
            {/* ...existing document details rendering... */}
          </ScrollArea>
        )}

        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          <div className="space-y-6 pr-4">
            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleDownload} disabled={isDownloading}>
                <Download className="h-4 w-4 mr-2" />
                {isDownloading ? 'Downloading...' : 'Download'}
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={`${import.meta.env.VITE_API_BASE_URL?.replace('/api', '')}/documents/${doc.id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Paperless
                </a>
              </Button>
            </div>

            {/* Preview */}
            {previewUrl && (
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={previewUrl}
                  className="w-full h-96"
                  title="Document Preview"
                />
              </div>
            )}

            {isLoadingPreview && (
              <div className="border rounded-lg h-96 flex items-center justify-center bg-muted">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 animate-pulse" />
                  <p>Loading preview...</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Metadata */}
            <div className="space-y-4">
              <h3 className="font-medium">Document Details</h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-medium">{doc.id}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="outline">
                    {getDocumentTypeName(doc.document_type)}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">
                    {format(new Date(doc.created), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Owner:</span>
                  <span className="font-medium">{doc.owner}</span>
                </div>
              </div>
            </div>

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-medium">Custom Fields</h3>
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    {customFields.map((field) => {
                      const value = getCustomFieldValue(field.id);
                      if (value === null || value === undefined) return null;

                      return (
                        <div key={field.id} className="flex justify-between">
                          <span className="text-muted-foreground">{field.name}:</span>
                          <span className="font-medium text-right">{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Content Preview */}
            {doc.content && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-medium">Content Preview</h3>
                  <div className="p-3 bg-muted rounded-lg text-sm max-h-48 overflow-auto whitespace-pre-wrap">
                    {doc.content.substring(0, 2000)}
                    {doc.content.length > 2000 && '...'}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
