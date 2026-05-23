import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MockPlaylist {
  id: string;
  name: string;
  trackCount: number;
}

@Component({
  selector: 'app-playlists',
  templateUrl: './playlists.component.html',
  styleUrls: ['./playlists.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class PlaylistsComponent {
  @Input() open = false;

  readonly playlists: MockPlaylist[] = [
    { id: '1', name: 'Favoritas',      trackCount: 24 },
    { id: '2', name: 'Lo-fi Noturno',  trackCount: 12 },
    { id: '3', name: 'Energia Máxima', trackCount: 18 },
    { id: '4', name: 'Tarde de Chuva', trackCount:  9 },
    { id: '5', name: 'Workout',        trackCount: 31 },
    { id: '6', name: 'Viagem',         trackCount: 15 },
  ];
}