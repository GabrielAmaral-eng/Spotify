import { Component, inject } from '@angular/core';
import { PlayerService } from '../../../core/services/player.service';

@Component({
  selector: 'app-mini-player',
  templateUrl: './mini-player.component.html',
  styleUrls: ['./mini-player.component.scss'],
  standalone: false
})
export class MiniPlayerComponent {
  private readonly playerService = inject(PlayerService);

  readonly currentTrack$ = this.playerService.currentTrack$;
  readonly isPlaying$ = this.playerService.isPlaying$;
  readonly progress$ = this.playerService.progress$;

  toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.playerService.toggle();
  }
}
