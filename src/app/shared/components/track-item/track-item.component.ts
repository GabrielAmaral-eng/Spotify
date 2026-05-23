import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Track } from '../../models/track.model';

@Component({
  selector: 'app-track-item',
  templateUrl: './track-item.component.html',
  styleUrls: ['./track-item.component.scss'],
  standalone: false
})
export class TrackItemComponent {
  @Input({ required: true }) track!: Track;
  @Input() favorite = false;
  @Input() showActions = true;
  @Input() removable = false;

  @Output() playTrack = new EventEmitter<Track>();
  @Output() toggleFavorite = new EventEmitter<Track>();
  @Output() addToPlaylist = new EventEmitter<Track>();
  @Output() removeTrack = new EventEmitter<Track>();

  onPlay(): void {
    this.playTrack.emit(this.track);
  }

  onFavorite(event: Event): void {
    event.stopPropagation();
    this.toggleFavorite.emit(this.track);
  }

  onAdd(event: Event): void {
    event.stopPropagation();
    this.addToPlaylist.emit(this.track);
  }

  onRemove(event: Event): void {
    event.stopPropagation();
    this.removeTrack.emit(this.track);
  }
}
