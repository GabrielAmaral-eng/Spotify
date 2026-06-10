export interface Track {
  id: string;
  source: 'audius';
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  duration: number;
  previewUrl: string | null;
}
