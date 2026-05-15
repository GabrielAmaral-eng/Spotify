export interface Track {
  id: string;
  source: 'spotify';
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  duration: number;
  previewUrl: string | null;
}
