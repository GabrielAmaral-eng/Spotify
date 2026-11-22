import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, chmod, copyFile, open } from 'node:fs/promises';

// Na Lambda o binario vem da layer em /opt/bin/ffmpeg. Localmente, aponte
// FFMPEG_PATH para um ffmpeg do sistema (ou o do pacote ffmpeg-static).
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';
const MP3_BITRATE = process.env.MP3_BITRATE || '320k';

let ffmpegReady: Promise<string> | null = null;

/**
 * Garante um ffmpeg executavel. Zips gerados no Windows podem perder o bit de
 * execucao; nesse caso copia para /tmp e aplica chmod (a layer e somente
 * leitura).
 */
export function resolveFfmpeg(): Promise<string> {
  ffmpegReady ??= (async () => {
    try {
      await access(FFMPEG_PATH, constants.X_OK);
      return FFMPEG_PATH;
    } catch {
      const fallback = '/tmp/ffmpeg';
      await copyFile(FFMPEG_PATH, fallback);
      await chmod(fallback, 0o755);
      return fallback;
    }
  })();

  return ffmpegReady;
}

/** O original ja e MP3? (tag ID3 ou frame MPEG layer III no inicio). */
export async function isMp3File(path: string): Promise<boolean> {
  const file = await open(path, 'r');

  try {
    const head = Buffer.alloc(4);
    const { bytesRead } = await file.read(head, 0, 4, 0);

    if (bytesRead < 3) {
      return false;
    }

    if (head.toString('latin1', 0, 3) === 'ID3') {
      return true;
    }

    // 11 bits de sincronia + layer III.
    return head[0] === 0xff && (head[1] & 0xe6) === 0xe2;
  } finally {
    await file.close();
  }
}

export interface Mp3Metadata {
  title: string;
  artist: string;
}

/**
 * Converte qualquer audio que o ffmpeg leia (FLAC, WAV, AIFF, M4A...) para
 * MP3 CBR. So a primeira faixa de audio e usada (capas/video sao ignorados);
 * a taxa de amostragem e ajustada automaticamente ao que o MP3 suporta.
 */
export async function transcodeToMp3(
  input: string,
  output: string,
  metadata: Mp3Metadata
): Promise<void> {
  const ffmpeg = await resolveFfmpeg();

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    '-y',
    '-i', input,
    '-map', '0:a:0',
    '-vn',
    '-c:a', 'libmp3lame',
    '-b:a', MP3_BITRATE,
    '-map_metadata', '-1',
    '-id3v2_version', '3',
    '-metadata', `title=${metadata.title}`,
    '-metadata', `artist=${metadata.artist}`,
    output
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk: Buffer) => {
      // Guarda so o fim do log (o suficiente para diagnosticar).
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg saiu com codigo ${code}: ${stderr.trim()}`));
      }
    });
  });
}

/** "Artista - Titulo.mp3" sem caracteres invalidos (Windows/Android/iOS). */
export function buildFileName(artist: string, title: string): string {
  const cleaned = `${artist} - ${title}`
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex -- remover controle e o objetivo
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');

  return `${(cleaned || 'faixa').slice(0, 150).trim()}.mp3`;
}

/**
 * Content-Disposition com fallback ASCII (filename) e nome completo em UTF-8
 * (filename*, RFC 5987/6266).
 */
export function contentDisposition(fileName: string): string {
  const ascii = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');

  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
