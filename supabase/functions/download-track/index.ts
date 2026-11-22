// Edge Function (FaaS) de download de faixas do Audius.
//
// GET  /functions/v1/download-track?id=<trackId>         -> arquivo (attachment)
// GET  /functions/v1/download-track?id=<trackId>&link=1  -> JSON { url, fileName }
// HEAD /functions/v1/download-track?id=<trackId>         -> so os cabecalhos
//
// 1. Busca a faixa no Audius e confere se o artista liberou o download.
// 2. Com MP3_CONVERTER_URL configurada (padrao em producao): pede a Lambda
//    melodix-mp3-converter (AWS) o MP3 320 kbps da faixa. A Lambda baixa o
//    original pelo /download oficial, converte com ffmpeg, guarda no S3 e
//    devolve um link assinado; aqui respondemos 302 para ele (ou o JSON, no
//    modo link=1, usado pelo app para mostrar o carregamento).
// 3. Sem a Lambda: repassa o arquivo ORIGINAL do /download oficial em
//    streaming (FLAC/WAV/MP3, conforme o artista enviou).
//
// Nunca usa o /stream. Publica (verify_jwt = false): baixar nao exige conta.
//
// Variaveis/secrets:
//   ALLOWED_ORIGINS       origens liberadas no CORS, separadas por virgula
//   AUDIUS_APP_NAME       app_name enviado ao Audius (padrao "Melodix")
//   MP3_CONVERTER_URL     Function URL da Lambda (sem ela, entrega o original)
//   MP3_CONVERTER_SECRET  segredo compartilhado com a Lambda

const AUDIUS_API = 'https://api.audius.co/v1';
const APP_NAME = Deno.env.get('AUDIUS_APP_NAME')?.trim() || 'Melodix';

const CONVERTER_URL = Deno.env.get('MP3_CONVERTER_URL')?.trim() || '';
const CONVERTER_SECRET = Deno.env.get('MP3_CONVERTER_SECRET')?.trim() || '';
// A primeira conversao de uma faixa leva de segundos a ~1 min; depois fica em
// cache no S3. Fica abaixo do limite de tempo das Edge Functions (150 s).
const CONVERTER_TIMEOUT_MS = 120_000;

// Sem o secret, libera so as origens de desenvolvimento e do Capacitor.
const DEFAULT_ORIGINS = [
  'http://localhost:8100',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
];
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? DEFAULT_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
);

// Tempo maximo esperando o Audius responder (cabecalhos). O corpo do arquivo
// nao tem limite: ele e repassado em streaming conforme chega.
const METADATA_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;

// IDs do Audius sao hashids curtos (letras e numeros).
const TRACK_ID_PATTERN = /^[A-Za-z0-9]{1,32}$/;

const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
};

interface AudiusTrack {
  id: string;
  title: string;
  user?: { name?: string; handle?: string };
  is_downloadable?: boolean;
  is_download_gated?: boolean;
}

class UpstreamError extends Error {}

Deno.serve(async (request: Request): Promise<Response> => {
  const cors = corsHeaders(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const isHead = request.method === 'HEAD';

  if (request.method !== 'GET' && !isHead) {
    return json({ error: 'Metodo nao permitido. Use GET.' }, 405, cors);
  }

  const params = new URL(request.url).searchParams;
  const id = params.get('id')?.trim() ?? '';
  const wantsLink = params.has('link');

  if (!TRACK_ID_PATTERN.test(id)) {
    return json({ error: 'Informe um id de faixa valido (?id=...).' }, 400, cors);
  }

  try {
    const track = await fetchTrack(id);

    if (!track) {
      return json({ error: 'Faixa nao encontrada.' }, 404, cors);
    }

    if (track.is_downloadable !== true || track.is_download_gated === true) {
      return json(
        {
          error: 'O artista nao liberou o download desta faixa.',
          code: 'NOT_DOWNLOADABLE',
        },
        403,
        cors,
      );
    }

    const baseName = sanitizeFileName(`${track.user?.name ?? 'Artista'} - ${track.title}`);

    if (CONVERTER_URL) {
      return await serveMp3(id, `${baseName}.mp3`, { isHead, wantsLink }, cors);
    }

    const upstream = await fetchWithTimeout(
      `${AUDIUS_API}/tracks/${id}/download?app_name=${encodeURIComponent(APP_NAME)}`,
      DOWNLOAD_TIMEOUT_MS,
    );

    if (upstream.status === 403 || upstream.status === 404) {
      await upstream.body?.cancel();
      return json(
        {
          error: 'O artista nao liberou o download desta faixa.',
          code: 'NOT_DOWNLOADABLE',
        },
        403,
        cors,
      );
    }

    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      throw new UpstreamError(`Audius /download respondeu ${upstream.status}`);
    }

    // O Audius entrega o arquivo ORIGINAL enviado pelo artista e as vezes o
    // rotula como .mp3 mesmo sendo FLAC/WAV. Os primeiros bytes dizem o
    // formato real; sem assinatura conhecida, vale o nome informado (ou mp3).
    const { head, body } = await peekStream(upstream.body, 16);
    const extension = sniffExtension(head) ??
      pickExtension(upstream.headers.get('content-disposition'));
    const fileName = `${baseName}.${extension}`;

    // Modo link sem a Lambda: o app baixa desta mesma URL (sem link=1).
    if (wantsLink) {
      await body.cancel();
      return json({ url: null, fileName }, 200, cors);
    }

    const headers = new Headers(cors);
    headers.set('Content-Type', pickContentType(extension, upstream.headers.get('content-type')));
    headers.set('Content-Disposition', contentDisposition(fileName));
    // Nome pronto (UTF-8 codificado) para o app, sem precisar parsear o header acima.
    headers.set('X-File-Name', encodeURIComponent(fileName));
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');

    const length = upstream.headers.get('content-length');
    if (length) {
      headers.set('Content-Length', length);
    }

    if (isHead) {
      await body.cancel();
      return new Response(null, { status: 200, headers });
    }

    return new Response(body, { status: 200, headers });
  } catch (error) {
    console.error('download-track:', error);
    return json(
      { error: 'Nao foi possivel falar com o Audius agora. Tente novamente.' },
      502,
      cors,
    );
  }
});

/**
 * MP3 pela Lambda de conversao. HEAD nao aciona a Lambda (so informa nome e
 * tipo). GET responde 302 para o link assinado do S3; com link=1, devolve o
 * link em JSON para o app controlar o carregamento.
 */
async function serveMp3(
  id: string,
  fileName: string,
  mode: { isHead: boolean; wantsLink: boolean },
  cors: Headers,
): Promise<Response> {
  if (mode.isHead) {
    const headers = new Headers(cors);
    headers.set('Content-Type', 'audio/mpeg');
    headers.set('Content-Disposition', contentDisposition(fileName));
    headers.set('X-File-Name', encodeURIComponent(fileName));
    headers.set('Cache-Control', 'no-store');
    return new Response(null, { status: 200, headers });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONVERTER_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${CONVERTER_URL.replace(/\/$/, '')}/?id=${encodeURIComponent(id)}`, {
      headers: { 'x-converter-secret': CONVERTER_SECRET },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      // A Lambda segue convertendo mesmo apos o timeout e guarda o MP3 no S3:
      // a proxima tentativa ja encontra o arquivo pronto.
      const headers = new Headers(cors);
      headers.set('Retry-After', '15');
      return json(
        {
          error: 'A conversao para MP3 ainda esta em andamento. Tente de novo em instantes.',
          code: 'CONVERTING',
        },
        503,
        headers,
      );
    }
    throw new UpstreamError(`Conversor indisponivel: ${error}`);
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => null) as
    | { url?: string; fileName?: string; error?: string; code?: string }
    | null;

  if (response.status === 403 || response.status === 404) {
    return json(payload ?? { error: 'Download indisponivel.' }, response.status, cors);
  }

  if (!response.ok || !payload?.url) {
    throw new UpstreamError(`Conversor respondeu ${response.status}: ${payload?.error ?? ''}`);
  }

  const result = { url: payload.url, fileName: payload.fileName ?? fileName };

  if (mode.wantsLink) {
    return json(result, 200, cors);
  }

  const headers = new Headers(cors);
  headers.set('Location', result.url);
  headers.set('Cache-Control', 'no-store');
  return new Response(null, { status: 302, headers });
}

/** Metadados da faixa; null quando o Audius diz que ela nao existe. */
async function fetchTrack(id: string): Promise<AudiusTrack | null> {
  const response = await fetchWithTimeout(
    `${AUDIUS_API}/tracks/${id}?app_name=${encodeURIComponent(APP_NAME)}`,
    METADATA_TIMEOUT_MS,
  );

  // O Audius responde 400 ("invalid trackId") para ids que nao decodificam.
  if (response.status === 404 || response.status === 400) {
    await response.body?.cancel();
    return null;
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new UpstreamError(`Audius /tracks respondeu ${response.status}`);
  }

  const payload = (await response.json()) as { data?: AudiusTrack | null };
  return payload?.data?.id ? payload.data : null;
}

/**
 * fetch com limite de tempo so ate chegarem os cabecalhos; depois disso o
 * corpo segue em streaming sem ser abortado. Redirecionamentos (o /download
 * responde 302 para o no de conteudo) sao seguidos automaticamente.
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: '*/*' },
    });
  } catch (error) {
    throw new UpstreamError(
      controller.signal.aborted ? `Timeout ao chamar ${url}` : String(error),
    );
  } finally {
    clearTimeout(timer);
  }
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Expose-Headers':
      'Content-Disposition, Content-Length, Content-Type, X-File-Name',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });

  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  return headers;
}

function json(body: unknown, status: number, cors: Headers): Response {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Le os primeiros bytes do stream sem perder nada: devolve esses bytes e um
 * novo stream que reemite o que foi lido e segue com o restante do original.
 */
async function peekStream(
  source: ReadableStream<Uint8Array>,
  minBytes: number,
): Promise<{ head: Uint8Array; body: ReadableStream<Uint8Array> }> {
  const reader = source.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (size < minBytes) {
    const { done, value } = await reader.read();
    if (done || !value) {
      break;
    }
    chunks.push(value);
    size += value.length;
  }

  const head = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    head.set(chunk, offset);
    offset += chunk.length;
  }

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (head.length > 0) {
        controller.enqueue(head);
      }
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
      } else if (value) {
        controller.enqueue(value);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return { head, body };
}

/** Formato real do audio pela assinatura (magic bytes) do arquivo. */
function sniffExtension(head: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...head.subarray(start, end));

  if (ascii(0, 4) === 'fLaC') return 'flac';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'wav';
  if (ascii(0, 4) === 'FORM' && ['AIFF', 'AIFC'].includes(ascii(8, 12))) return 'aiff';
  if (ascii(0, 4) === 'OggS') return 'ogg';
  if (ascii(4, 8) === 'ftyp') return 'm4a';
  if (ascii(0, 3) === 'ID3') return 'mp3';
  // Frame MPEG sem tag ID3: 11 bits de sincronia + layer III.
  if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe6) === 0xe2) return 'mp3';
  // ADTS (AAC puro): sincronia + layer 00.
  if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xf6) === 0xf0) return 'aac';

  return null;
}

/** Extensao do arquivo original informado pelo Audius (padrao mp3). */
function pickExtension(disposition: string | null): string {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const name = match ? decodeURIComponentSafe(match[1]) : '';
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return extension in AUDIO_TYPES ? extension : 'mp3';
}

function pickContentType(extension: string, upstreamType: string | null): string {
  if (AUDIO_TYPES[extension]) {
    return AUDIO_TYPES[extension];
  }
  return upstreamType && upstreamType !== 'application/octet-stream'
    ? upstreamType
    : 'application/octet-stream';
}

/** Remove caracteres invalidos em nomes de arquivo (Windows/Android/iOS). */
function sanitizeFileName(raw: string): string {
  const cleaned = raw
    .normalize('NFC')
    // deno-lint-ignore no-control-regex -- remover caracteres de controle e o objetivo
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');

  return (cleaned || 'faixa').slice(0, 150).trim();
}

/**
 * Content-Disposition com fallback ASCII (filename) e nome completo em UTF-8
 * (filename*, RFC 5987/6266) para acentos e outros alfabetos.
 */
function contentDisposition(fileName: string): string {
  const ascii = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');

  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
