-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', false);

-- RLS Policy: Users can view files from chats they participate in
CREATE POLICY "Участники чата могут видеть файлы"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'chat-files' AND
  auth.uid() IN (
    SELECT cp.user_id
    FROM chat_participants cp
    JOIN messages m ON m.chat_id = cp.chat_id
    WHERE m.file_url = storage.objects.name
  )
);

-- RLS Policy: Chat participants can upload files
CREATE POLICY "Участники чата могут загружать файлы"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.uid() IS NOT NULL
);

-- RLS Policy: Users can delete their own uploaded files
CREATE POLICY "Пользователи могут удалять свои файлы"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'chat-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);