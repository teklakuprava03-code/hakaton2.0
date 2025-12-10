-- Создаем публичный bucket для аватаров пользователей
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- RLS политики для bucket avatars
-- Все могут просматривать аватары
CREATE POLICY "Аватары доступны для просмотра всем"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Пользователи могут загружать свои аватары
CREATE POLICY "Пользователи могут загружать свои аватары"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Пользователи могут обновлять свои аватары
CREATE POLICY "Пользователи могут обновлять свои аватары"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Пользователи могут удалять свои аватары
CREATE POLICY "Пользователи могут удалять свои аватары"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);