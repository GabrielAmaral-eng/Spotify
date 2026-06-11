import { env } from '../../config/env';
import type { Track } from '../../types/track';
import { HttpError } from '../../utils/http-error';
import { audiusHttp } from './audius-http';

// Gateway publico do Audius. Nao exige API key nem OAuth; apenas o app_name.
const AUDIUS_API = 'https://api.audius.co';

interface AudiusArtwork {
  '150x150'?: string;
  '480x480'?: string;
  '1000x1000'?: string;
}

interface AudiusUser {
  name: string;
  handle: string;
}

interface AudiusTrack {
  id: string;
  title: string;
  user: AudiusUser;
  artwork: AudiusArtwork | null;
  duration: number;
  genre: string | null;
  is_stream_gated: boolean;
  is_available: boolean;
}

interface AudiusSearchResponse {
  data: AudiusTrack[];
}

interface AudiusTrackResponse {
  data: AudiusTrack | null;
}

class AudiusService {
  private readonly appName = env.AUDIUS_APP_NAME;

  async searchTracks(
    query: string,
    limit: number,
    offset: number
  ): Promise<{ tracks: Track[]; hasMore: boolean }> {
    const { data } = await audiusHttp.get<AudiusSearchResponse>(
      `${AUDIUS_API}/v1/tracks/search`,
      {
        params: { query, app_name: this.appName, limit, offset }
      }
    );

    const tracks = data.data
      .filter((track) => this.isPlayable(track))
      .map((track) => this.normalizeTrack(track));

    // O fim e decidido pela contagem crua (antes do filtro de reproduziveis):
    // uma pagina cheia de faixas nao-tocaveis esvaziaria 'tracks' sem que os
    // resultados tivessem acabado. Enquanto a API devolver itens nesta janela,
    // ha proxima pagina a buscar.
    return { tracks, hasMore: data.data.length > 0 };
  }

  async getTrack(id: string): Promise<Track> {
    const { data } = await audiusHttp.get<AudiusTrackResponse>(
      `${AUDIUS_API}/v1/tracks/${id}`,
      {
        params: { app_name: this.appName }
      }
    );

    if (!data?.data?.id) {
      throw new HttpError('Faixa nao encontrada.', 404);
    }

    return this.normalizeTrack(data.data);
  }

  private isPlayable(track: AudiusTrack): boolean {
    return Boolean(track?.id) && track.is_available !== false && track.is_stream_gated !== true;
  }

  private normalizeTrack(track: AudiusTrack): Track {
    const artwork = track.artwork ?? {};
    const thumbnail = artwork['480x480'] ?? artwork['150x150'] ?? '';
    const genre = track.genre?.trim();

    return {
      id: track.id,
      source: 'audius',
      title: track.title,
      artist: track.user?.name ?? 'Artista desconhecido',
      // O modelo exige album nao-vazio; usamos o genero como rotulo.
      album: genre && genre.length > 0 ? genre : 'Single',
      thumbnail,
      duration: track.duration ?? 0,
      previewUrl: this.buildStreamUrl(track.id)
    };
  }

  // URL estavel do endpoint de stream (302 -> mp3 completo). Diferente da
  // stream.url assinada, esta nao expira, entao funciona para faixas salvas
  // em playlists/favoritos tocadas depois.
  private buildStreamUrl(trackId: string): string {
    return `${AUDIUS_API}/v1/tracks/${trackId}/stream?app_name=${encodeURIComponent(this.appName)}`;
  }
}

export const audiusService = new AudiusService();
