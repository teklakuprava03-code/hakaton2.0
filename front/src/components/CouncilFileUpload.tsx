import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CouncilFileUploadProps {
  councilId: string;
  onUploadComplete: (filePath: string) => void;
}

export const CouncilFileUpload = ({ councilId, onUploadComplete }: CouncilFileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Неверный формат",
        description: "Поддерживаются только PDF, DOCX и TXT файлы",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Файл слишком большой",
        description: "Максимальный размер файла - 20MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${councilId}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('council-files')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      toast({
        title: "Успешно",
        description: "Файл загружен",
      });

      onUploadComplete(fileName);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить файл",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <div>
      <input
        type="file"
        id="council-file-upload"
        accept=".pdf,.docx,.txt"
        onChange={handleFileUpload}
        className="hidden"
        disabled={uploading}
      />
      <label htmlFor="council-file-upload">
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          asChild
        >
          <span className="cursor-pointer">
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Загрузка...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Загрузить протокол
              </>
            )}
          </span>
        </Button>
      </label>
      <p className="text-xs text-muted-foreground mt-2">
        PDF, DOCX или TXT (макс. 20MB)
      </p>
    </div>
  );
};
