-- Enable realtime for councils table
ALTER TABLE councils REPLICA IDENTITY FULL;

-- Add councils table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE councils;

-- Enable realtime for notifications table
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Add notifications table to realtime publication (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;