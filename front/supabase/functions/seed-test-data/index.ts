import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Doctor {
  email: string;
  password: string;
  fullName: string;
  role: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 10 врачей для тестирования
    const doctors: Doctor[] = [
      { email: 'ivanov@clinic.ru', password: 'test123456', fullName: 'Иванов Иван Иванович', role: 'doctor' },
      { email: 'smirnova@clinic.ru', password: 'test123456', fullName: 'Смирнова Анна Владимировна', role: 'doctor' },
      { email: 'petrova@clinic.ru', password: 'test123456', fullName: 'Петрова Ольга Сергеевна', role: 'doctor' },
      { email: 'kozlov@clinic.ru', password: 'test123456', fullName: 'Козлов Дмитрий Александрович', role: 'doctor' },
      { email: 'sokolova@clinic.ru', password: 'test123456', fullName: 'Соколова Елена Михайловна', role: 'nurse' },
      { email: 'morozov@clinic.ru', password: 'test123456', fullName: 'Морозов Сергей Викторович', role: 'doctor' },
      { email: 'novikova@clinic.ru', password: 'test123456', fullName: 'Новикова Татьяна Андреевна', role: 'nurse' },
      { email: 'volkov@clinic.ru', password: 'test123456', fullName: 'Волков Алексей Николаевич', role: 'doctor' },
      { email: 'lebedev@clinic.ru', password: 'test123456', fullName: 'Лебедев Павел Игоревич', role: 'doctor' },
      { email: 'kuznetsova@clinic.ru', password: 'test123456', fullName: 'Кузнецова Мария Петровна', role: 'chief_doctor' },
    ];

    const createdUsers = [];

    // Создаем врачей
    for (const doctor of doctors) {
      // Создаем пользователя
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: doctor.email,
        password: doctor.password,
        email_confirm: true,
        user_metadata: {
          full_name: doctor.fullName
        }
      });

      if (userError) {
        console.error(`Error creating user ${doctor.email}:`, userError);
        continue;
      }

      if (!userData.user) {
        console.error(`No user created for ${doctor.email}`);
        continue;
      }

      // Создаем профиль
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userData.user.id,
          full_name: doctor.fullName,
          email: doctor.email,
        });

      if (profileError) {
        console.error(`Error creating profile for ${doctor.email}:`, profileError);
      }

      // Назначаем роль
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userData.user.id,
          role: doctor.role,
        });

      if (roleError) {
        console.error(`Error assigning role for ${doctor.email}:`, roleError);
      }

      createdUsers.push({
        id: userData.user.id,
        email: doctor.email,
        fullName: doctor.fullName,
        role: doctor.role
      });
    }

    // Получаем пациентов
    const { data: patients, error: patientsError } = await supabaseAdmin
      .from('patients')
      .select('*')
      .limit(3);

    if (patientsError) {
      console.error('Error fetching patients:', patientsError);
    }

    // Создаем Patient Chats для каждого пациента
    if (patients && patients.length > 0 && createdUsers.length > 0) {
      for (const patient of patients) {
        // Создаем чат для пациента
        const { data: chat, error: chatError } = await supabaseAdmin
          .from('chats')
          .insert({
            type: 'patient_chat',
            patient_id: patient.id,
            name: `Чат по пациенту: ${patient.full_name}`,
          })
          .select()
          .single();

        if (chatError) {
          console.error(`Error creating chat for patient ${patient.full_name}:`, chatError);
          continue;
        }

        // Добавляем первых 3-4 врачей как участников чата
        const doctorsToAdd = createdUsers.filter(u => u.role === 'doctor').slice(0, 4);
        
        for (const doctor of doctorsToAdd) {
          const { error: participantError } = await supabaseAdmin
            .from('chat_participants')
            .insert({
              chat_id: chat.id,
              user_id: doctor.id,
            });

          if (participantError) {
            console.error(`Error adding participant to chat:`, participantError);
          }
        }

        // Добавляем несколько тестовых сообщений
        const messages = [
          {
            chat_id: chat.id,
            sender_id: doctorsToAdd[0]?.id,
            content: `Пациент поступил с диагнозом: ${patient.diagnosis}. Необходимо обсудить тактику лечения.`
          },
          {
            chat_id: chat.id,
            sender_id: doctorsToAdd[1]?.id,
            content: `Ознакомился с историей болезни. Предлагаю начать с базовой терапии и мониторинга состояния.`
          },
          {
            chat_id: chat.id,
            sender_id: doctorsToAdd[2]?.id,
            content: `Согласен. Также рекомендую назначить дополнительные обследования.`
          }
        ];

        for (const message of messages) {
          if (message.sender_id) {
            await supabaseAdmin.from('messages').insert(message);
          }
        }
      }
    }

    // Создаем несколько личных чатов между врачами
    if (createdUsers.length >= 2) {
      const personalChats = [
        { user1: 0, user2: 1 },
        { user1: 0, user2: 2 },
        { user1: 1, user2: 3 },
      ];

      for (const chatPair of personalChats) {
        const user1 = createdUsers[chatPair.user1];
        const user2 = createdUsers[chatPair.user2];

        if (user1 && user2) {
          const { data: personalChat, error: personalChatError } = await supabaseAdmin
            .from('chats')
            .insert({
              type: 'personal',
              name: `${user1.fullName} ↔ ${user2.fullName}`,
            })
            .select()
            .single();

          if (!personalChatError && personalChat) {
            await supabaseAdmin.from('chat_participants').insert([
              { chat_id: personalChat.id, user_id: user1.id },
              { chat_id: personalChat.id, user_id: user2.id },
            ]);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Тестовые данные успешно созданы',
        createdUsers: createdUsers.length,
        doctors: createdUsers.map(u => ({
          email: u.email,
          password: 'test123456',
          role: u.role
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});