-- Create storage bucket for council protocol files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'council-files',
  'council-files',
  false,
  20971520, -- 20MB limit
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
);

-- RLS policies for council-files bucket
CREATE POLICY "Медперсонал может просматривать файлы консилиумов"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'council-files' 
  AND is_medical_staff(auth.uid())
);

CREATE POLICY "Медперсонал может загружать файлы консилиумов"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'council-files' 
  AND is_medical_staff(auth.uid())
);

CREATE POLICY "Медперсонал может удалять файлы консилиумов"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'council-files' 
  AND is_medical_staff(auth.uid())
);