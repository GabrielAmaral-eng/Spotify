import { Component, OnInit, inject } from '@angular/core';
import { PlaylistService } from '../../core/services/playlist.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {
  private readonly playlistService = inject(PlaylistService);

  readonly playlists$ = this.playlistService.playlists$;
  readonly favorites$ = this.playlistService.favorites$;

  ngOnInit(): void {
    this.playlistService.loadPlaylists().subscribe();
    this.playlistService.loadFavorites().subscribe();
  }
}
