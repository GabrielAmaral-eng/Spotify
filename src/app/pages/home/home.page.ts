import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PlaylistService } from '../../core/services/playlist.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly playlistService = inject(PlaylistService);
  private readonly router = inject(Router);

  readonly playlists$ = this.playlistService.playlists$;
  readonly favorites$ = this.playlistService.favorites$;

  ngOnInit(): void {
    this.playlistService.loadPlaylists().subscribe();
    this.playlistService.loadFavorites().subscribe();
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }
}
