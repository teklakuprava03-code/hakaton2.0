import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GigaChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function getGigaChatToken(credentials: string): Promise<string> {
  const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
      'RqUID': crypto.randomUUID(),
    },
    body: 'scope=GIGACHAT_API_PERS',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('GigaChat auth error:', error);
    throw new Error(`Failed to authenticate: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function extractTextFromPDF(fileData: Uint8Array): Promise<string> {
  try {
    // Use pdf-parse library for PDF text extraction
    const pdfParse = (await import('https://esm.sh/pdf-parse@1.1.1')).default;
    const pdfData = await pdfParse(fileData);
    return pdfData.text.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function extractTextFromDOCX(fileData: Uint8Array): Promise<string> {
  try {
    const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
    const zip = await JSZip.loadAsync(fileData);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    
    if (!documentXml) {
      throw new Error('Could not find document.xml in DOCX file');
    }

    const textMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    if (!textMatches) return '';

    return textMatches
      .map(match => match.replace(/<[^>]*>/g, ''))
      .join(' ')
      .trim();
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX');
  }
}

async function extractTextFromFile(fileData: Uint8Array, mimeType: string): Promise<string> {
  console.log('Extracting text from file, mime type:', mimeType);

  if (mimeType === 'application/pdf') {
    return await extractTextFromPDF(fileData);
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return await extractTextFromDOCX(fileData);
  } else if (mimeType === 'text/plain') {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(fileData);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

async function summarizeWithGigaChat(transcript: string, token: string): Promise<string> {
  const systemPrompt = `Ты - медицинский ассистент, специализирующийся на анализе консилиумов. 
Твоя задача - создать структурированное резюме протокола консилиума. 
Резюме должно включать:
1. Очищенный текст протокола (без лишних символов)
2. Тематический анализ ключевых обсуждаемых точек
3. Краткое резюме на 5-10 строк с основными выводами и рекомендациями`;

  const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: 'GigaChat',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Проанализируй следующий протокол консилиума:\n\n${transcript}`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('GigaChat API error:', error);
    throw new Error(`GigaChat API error: ${response.status}`);
  }

  const data: GigaChatResponse = await response.json();
  return data.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { councilId, filePath } = await req.json();

    if (!councilId) {
      return new Response(
        JSON.stringify({ error: 'councilId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const gigachatCredentials = Deno.env.get('GIGACHAT_API_KEY');

    if (!gigachatCredentials) {
      throw new Error('GIGACHAT_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch council data
    const { data: council, error: fetchError } = await supabase
      .from('councils')
      .select('transcript, has_ai_summary')
      .eq('id', councilId)
      .single();

    if (fetchError) {
      console.error('Error fetching council:', fetchError);
      throw new Error('Failed to fetch council data');
    }

    let transcriptText = council.transcript || '';

    // If filePath is provided, download and extract text from file
    if (filePath) {
      console.log('Downloading file from storage:', filePath);
      
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from('council-files')
        .download(filePath);

      if (downloadError) {
        console.error('Error downloading file:', downloadError);
        throw new Error('Failed to download file');
      }

      // Determine mime type from file extension
      const mimeType = filePath.endsWith('.pdf') ? 'application/pdf' : 
                       filePath.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 
                       'text/plain';

      // Convert blob to Uint8Array
      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Extract text from file
      transcriptText = await extractTextFromFile(uint8Array, mimeType);
      console.log('Extracted text length:', transcriptText.length);

      // Update council with extracted transcript
      await supabase
        .from('councils')
        .update({ transcript: transcriptText })
        .eq('id', councilId);
    }

    if (!transcriptText) {
      return new Response(
        JSON.stringify({ error: 'No transcript or file available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get GigaChat token
    console.log('Getting GigaChat token...');
    const token = await getGigaChatToken(gigachatCredentials);

    // Generate summary
    console.log('Generating summary...');
    const summary = await summarizeWithGigaChat(transcriptText, token);

    // Update council with summary
    const { error: updateError } = await supabase
      .from('councils')
      .update({ 
        summary,
        has_ai_summary: true 
      })
      .eq('id', councilId);

    if (updateError) {
      console.error('Error updating council:', updateError);
      throw new Error('Failed to save summary');
    }

    console.log('Summary generated successfully');

    return new Response(
      JSON.stringify({ summary, transcript: transcriptText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in summarize-council:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
