import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

const AUDIUS_API = 'https://api.audius.co/v1';
const APP_NAME = process.env.AUDIUS_APP_NAME?.trim() || 'Melodix';

// Tempo maximo esperando o Audius responder (cabecalhos); o corpo do arquivo
// segue sem limite proprio (vale o timeout da Lambda).
const METADATA_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;

export interface AudiusTrack {
  id: string;
  title: string;
  user?: { name?: string };
  is_downloadable?: boolean;
  is_download_gated?: boolean;
}

/** Erro de comunicacao com o Audius (timeout, 5xx): vira 502. */
export class UpstreamError extends Error {}

/** Mesma regra do backend e da Edge Function: liberado e sem condicao. */
export function isDownloadable(track: AudiusTrack): boolean {
  return track.is_downloadable === true && track.is_download_gated !== true;
}

/** Metadados da faixa; null quando o Audius diz que ela nao existe. */
export async function fetchTrack(id: string): Promise<AudiusTrack | null> {
  const response = await fetchWithTimeout(
    `${AUDIUS_API}/tracks/${id}?app_name=${encodeURIComponent(APP_NAME)}`,
    METADATA_TIMEOUT_MS
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
 * Baixa o arquivo ORIGINAL pelo endpoint oficial /download (302 para o no
 * de conteudo) direto para o disco, sem carregar tudo na memoria.
 * Devolve false se o Audius negar o download (403/404).
 */
export async function downloadOriginal(id: string, destination: string): Promise<boolean> {
  const response = await fetchWithTimeout(
    `${AUDIUS_API}/tracks/${id}/download?app_name=${encodeURIComponent(APP_NAME)}`,
    DOWNLOAD_TIMEOUT_MS
  );

  if (response.status === 403 || response.status === 404) {
    await response.body?.cancel();
    return false;
  }

  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new UpstreamError(`Audius /download respondeu ${response.status}`);
  }

  await pipeline(
    Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>),
    createWriteStream(destination)
  );

  return true;
}

/** fetch com limite de tempo so ate chegarem os cabecalhos. */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal, redirect: 'follow' });
  } catch (error) {
    throw new UpstreamError(
      controller.signal.aborted ? `Timeout ao chamar ${url}` : String(error)
    );
  } finally {
    clearTimeout(timer);
  }
}
