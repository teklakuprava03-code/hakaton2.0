-- Создание enum для ролей пользователей
CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'nurse', 'orderly', 'department_head', 'chief_doctor');

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Таблица профилей пользователей
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица ролей пользователей (отдельная для безопасности)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Security definer функция для проверки ролей
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Функция для проверки любой роли врача
CREATE OR REPLACE FUNCTION public.is_medical_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('admin', 'doctor', 'nurse', 'orderly', 'department_head', 'chief_doctor')
  )
$$;

-- Таблица пациентов
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('М', 'Ж')),
  diagnosis TEXT NOT NULL,
  room TEXT,
  admission_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'stable' CHECK (status IN ('critical', 'stable', 'observation', 'discharged')),
  medical_history TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица чатов
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('personal', 'patient_chat', 'ai_assistant')),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица участников чатов
CREATE TABLE public.chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chat_id, user_id)
);

-- Таблица сообщений
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image', 'audio', 'video')),
  file_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица консилиумов
CREATE TABLE public.councils (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  transcript TEXT,
  summary TEXT,
  has_ai_summary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица участников консилиумов
CREATE TABLE public.council_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id UUID NOT NULL REFERENCES public.councils(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT,
  UNIQUE(council_id, user_id)
);

-- Таблица файлов пациентов
CREATE TABLE public.patient_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.councils ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies для profiles
CREATE POLICY "Пользователи могут видеть все профили" ON public.profiles
  FOR SELECT USING (public.is_medical_staff(auth.uid()));

CREATE POLICY "Пользователи могут обновлять свой профиль" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Пользователи могут создавать свой профиль" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies для user_roles
CREATE POLICY "Пользователи могут видеть свои роли" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Только админы могут управлять ролями" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies для patients
CREATE POLICY "Медперсонал может видеть всех пациентов" ON public.patients
  FOR SELECT USING (public.is_medical_staff(auth.uid()));

CREATE POLICY "Врачи могут создавать пациентов" ON public.patients
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Врачи могут обновлять пациентов" ON public.patients
  FOR UPDATE USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies для chats
CREATE POLICY "Пользователи видят чаты, в которых участвуют" ON public.chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_id = chats.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Медперсонал может создавать чаты" ON public.chats
  FOR INSERT WITH CHECK (public.is_medical_staff(auth.uid()));

-- RLS Policies для chat_participants
CREATE POLICY "Участники видят других участников своих чатов" ON public.chat_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = chat_participants.chat_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Медперсонал может добавлять участников" ON public.chat_participants
  FOR INSERT WITH CHECK (public.is_medical_staff(auth.uid()));

-- RLS Policies для messages
CREATE POLICY "Участники чата видят сообщения" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_id = messages.chat_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Участники могут отправлять сообщения" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_id = messages.chat_id AND user_id = auth.uid()
    )
  );

-- RLS Policies для councils
CREATE POLICY "Медперсонал видит консилиумы" ON public.councils
  FOR SELECT USING (public.is_medical_staff(auth.uid()));

CREATE POLICY "Врачи могут создавать консилиумы" ON public.councils
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Врачи могут обновлять консилиумы" ON public.councils
  FOR UPDATE USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies для council_participants
CREATE POLICY "Медперсонал видит участников консилиумов" ON public.council_participants
  FOR SELECT USING (public.is_medical_staff(auth.uid()));

CREATE POLICY "Врачи могут добавлять участников консилиумов" ON public.council_participants
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies для patient_files
CREATE POLICY "Медперсонал видит файлы пациентов" ON public.patient_files
  FOR SELECT USING (public.is_medical_staff(auth.uid()));

CREATE POLICY "Медперсонал может загружать файлы" ON public.patient_files
  FOR INSERT WITH CHECK (public.is_medical_staff(auth.uid()) AND auth.uid() = uploaded_by);

-- Триггеры для updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_councils_updated_at
  BEFORE UPDATE ON public.councils
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Включить realtime для сообщений
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;