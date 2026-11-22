export interface Track {
  id: string;
  source: 'audius';
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  duration: number;
  previewUrl: string | null;
  /**
   * Artista liberou o download. Vem da busca/faixa do Audius; faixas salvas
   * na biblioteca (favoritos/playlists) nao guardam o campo, entao ausente =
   * desconhecido (o DownloadService consulta /audius/track/:id).
   */
  downloadable?: boolean;
}
