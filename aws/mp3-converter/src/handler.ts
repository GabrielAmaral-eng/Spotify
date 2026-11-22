// AWS Lambda (Function URL) que entrega a faixa do Audius em MP3.
//
// GET <function-url>/?id=<trackId>   (header x-converter-secret obrigatorio)
//   200 { url, fileName, cached }  url = link temporario (S3) para baixar
//   403 artista nao liberou | 404 faixa nao existe | 502 erro do Audius
//
// Chamada pela Edge Function download-track (Supabase), nao pelo app.
//
// Fluxo: confere a liberacao no Audius -> procura mp3/<id>.mp3 no S3 ->
// se nao houver, baixa o ORIGINAL pelo /download oficial, converte com
// ffmpeg (MP3 320 kbps) e envia ao S3 -> devolve um link assinado.

import { createReadStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { LambdaFunctionURLEvent, LambdaFunctionURLResult } from 'aws-lambda';
import { UpstreamError, downloadOriginal, fetchTrack, isDownloadable } from './audius.js';
import { buildFileName, contentDisposition, isMp3File, transcodeToMp3 } from './convert.js';

const BUCKET = requiredEnv('BUCKET_NAME');
const CONVERTER_SECRET = requiredEnv('CONVERTER_SECRET');
const URL_TTL_SECONDS = Number(process.env.URL_TTL_SECONDS) || 900;
const KEY_PREFIX = 'mp3/';

// IDs do Audius sao hashids curtos (letras e numeros).
const TRACK_ID_PATTERN = /^[A-Za-z0-9]{1,32}$/;

const s3 = new S3Client({});

export const handler = async (event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> => {
  if (event.requestContext.http.method !== 'GET') {
    return json(405, { error: 'Metodo nao permitido. Use GET.' });
  }

  if (!hasValidSecret(event.headers['x-converter-secret'])) {
    return json(401, { error: 'Nao autorizado.' });
  }

  const id = event.queryStringParameters?.id?.trim() ?? '';
  if (!TRACK_ID_PATTERN.test(id)) {
    return json(400, { error: 'Informe um id de faixa valido (?id=...).' });
  }

  try {
    // A permissao e conferida aqui tambem (nao so na Edge Function): mesmo
    // com o segredo, a Lambda nunca converte faixa que o artista nao liberou.
    const track = await fetchTrack(id);

    if (!track) {
      return json(404, { error: 'Faixa nao encontrada.' });
    }

    if (!isDownloadable(track)) {
      return notDownloadable();
    }

    const artist = track.user?.name?.trim() || 'Artista';
    const fileName = buildFileName(artist, track.title);
    const key = `${KEY_PREFIX}${id}.mp3`;

    let cached = await objectExists(key);

    if (!cached) {
      const converted = await convertAndStore(id, key, { artist, title: track.title }, fileName);
      if (!converted) {
        return notDownloadable();
      }
    }

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        // O nome vai no proprio link: o navegador/app salva como
        // "Artista - Titulo.mp3" mesmo que o objeto tenha sido criado antes.
        ResponseContentDisposition: contentDisposition(fileName),
        ResponseContentType: 'audio/mpeg'
      }),
      { expiresIn: URL_TTL_SECONDS }
    );

    return json(200, { url, fileName, cached });
  } catch (error) {
    console.error('mp3-converter:', error);

    if (error instanceof UpstreamError) {
      return json(502, { error: 'Nao foi possivel falar com o Audius agora. Tente novamente.' });
    }

    return json(500, { error: 'Falha ao converter a faixa para MP3.' });
  }
};

/**
 * Baixa o original para /tmp, converte (ou reaproveita, se ja for MP3) e
 * envia ao S3. Devolve false se o Audius negar o download.
 */
async function convertAndStore(
  id: string,
  key: string,
  metadata: { artist: string; title: string },
  fileName: string
): Promise<boolean> {
  const workDir = await mkdtemp(join(tmpdir(), `mp3-${id}-`));
  const original = join(workDir, 'original');
  const mp3 = join(workDir, 'output.mp3');

  try {
    const started = Date.now();

    if (!(await downloadOriginal(id, original))) {
      return false;
    }

    const downloadedAt = Date.now();
    const alreadyMp3 = await isMp3File(original);

    // Original ja em MP3: envia como esta (reconverter so perderia qualidade).
    const source = alreadyMp3 ? original : mp3;
    if (!alreadyMp3) {
      await transcodeToMp3(original, mp3, metadata);
    }

    const { size } = await stat(source);

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: createReadStream(source),
        ContentLength: size,
        ContentType: 'audio/mpeg',
        ContentDisposition: contentDisposition(fileName),
        Metadata: { 'audius-track-id': id, transcoded: String(!alreadyMp3) }
      })
    );

    console.log(
      JSON.stringify({
        id,
        transcoded: !alreadyMp3,
        bytes: size,
        downloadMs: downloadedAt - started,
        totalMs: Date.now() - started
      })
    );

    return true;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (error) {
    if (error instanceof NotFound || (error as { name?: string })?.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/** Compara o segredo em tempo constante. */
function hasValidSecret(received: string | undefined): boolean {
  if (!received) {
    return false;
  }

  const expected = Buffer.from(CONVERTER_SECRET);
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function notDownloadable(): LambdaFunctionURLResult {
  return json(403, {
    error: 'O artista nao liberou o download desta faixa.',
    code: 'NOT_DOWNLOADABLE'
  });
}

function json(statusCode: number, body: unknown): LambdaFunctionURLResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente ${name} nao configurada.`);
  }
  return value;
}
