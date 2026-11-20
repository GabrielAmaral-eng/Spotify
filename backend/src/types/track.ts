export interface Track {
  id: string;
  source: 'audius';
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  duration: number;
  previewUrl: string | null;
  // Artista liberou o download da faixa (ver download-track no Supabase).
  downloadable: boolean;
}

// Faixa como fica salva na biblioteca (favoritos/playlists). O banco nao
// guarda 'downloadable': o front consulta /audius/track/:id quando precisar.
export type SavedTrack = Omit<Track, 'downloadable'>;
