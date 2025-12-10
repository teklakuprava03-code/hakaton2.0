-- Create notification settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  notify_messages BOOLEAN NOT NULL DEFAULT true,
  notify_councils BOOLEAN NOT NULL DEFAULT true,
  notify_critical BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings
CREATE POLICY "Пользователи видят свои настройки"
  ON public.notification_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Пользователи могут создавать свои настройки"
  ON public.notification_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Пользователи могут обновлять свои настройки"
  ON public.notification_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();