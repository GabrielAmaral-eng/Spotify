import { Component, Input, OnInit } from '@angular/core';

export interface MockPlaylist {
  id: string;
  name: string;
  trackCount: number;
  emoji: string;
}

@Component({
  selector: 'app-playlists',
  templateUrl: './playlists.component.html',
  styleUrls: ['./playlists.component.scss'],
})
export class PlaylistsComponent implements OnInit {
  @Input() open = false;

  readonly playlists: MockPlaylist[] = [
    { id: '1', name: 'Favoritas',        trackCount: 24, emoji: '❤️' },
    { id: '2', name: 'Lo-fi Noturno',    trackCount: 12, emoji: '🌙' },
    { id: '3', name: 'Energia Máxima',   trackCount: 18, emoji: '⚡' },
    { id: '4', name: 'Tarde de Chuva',   trackCount: 9,  emoji: '🌧️' },
    { id: '5', name: 'Workout',          trackCount: 31, emoji: '🏋️' },
    { id: '6', name: 'Viagem',           trackCount: 15, emoji: '✈️' },
  ];

  ngOnInit(): void {}
}