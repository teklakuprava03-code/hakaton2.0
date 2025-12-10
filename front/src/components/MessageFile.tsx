import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageFileProps {
  fileUrl: string;
  fileName?: string;
}

export const MessageFile = ({ fileUrl, fileName }: MessageFileProps) => {
  const [downloading, setDownloading] = useState(false);

  const getFileExtension = () => {
    return fileUrl.split('.').pop()?.toLowerCase() || '';
  };

  const isImage = () => {
    const ext = getFileExtension();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  };

  const getDisplayFileName = () => {
    if (fileName) return fileName;
    const parts = fileUrl.split('/');
    return parts[parts.length - 1];
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('chat-files')
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = getDisplayFileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    } finally {
      setDownloading(false);
    }
  };

  const getPublicUrl = () => {
    const { data } = supabase.storage
      .from('chat-files')
      .getPublicUrl(fileUrl);
    return data.publicUrl;
  };

  if (isImage()) {
    return (
      <div className="mt-2 space-y-2">
        <div className="relative max-w-sm">
          <img
            src={getPublicUrl()}
            alt={getDisplayFileName()}
            className="rounded-lg border border-border max-h-64 object-cover"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
          className="text-xs"
        >
          {downloading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Download className="h-3 w-3 mr-1" />
          )}
          Скачать
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2 p-3 bg-accent/50 rounded-lg border border-border max-w-sm">
      <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{getDisplayFileName()}</p>
        <p className="text-xs text-muted-foreground">{getFileExtension().toUpperCase()}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};
