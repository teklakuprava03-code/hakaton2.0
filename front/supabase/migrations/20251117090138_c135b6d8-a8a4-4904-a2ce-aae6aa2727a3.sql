-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL, -- 'message', 'council', 'patient_critical'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID, -- ID of related entity (chat_id, council_id, patient_id)
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Пользователи видят свои уведомления"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Пользователи могут обновлять свои уведомления"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Medical staff can create notifications
CREATE POLICY "Медперсонал может создавать уведомления"
ON public.notifications
FOR INSERT
WITH CHECK (is_medical_staff(auth.uid()));

-- Add index for faster queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;