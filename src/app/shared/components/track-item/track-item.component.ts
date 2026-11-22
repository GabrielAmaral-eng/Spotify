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
  /** Download desta faixa em andamento (mostra spinner no botao). */
  @Input() downloading = false;

  @Output() playTrack = new EventEmitter<Track>();
  @Output() toggleFavorite = new EventEmitter<Track>();
  @Output() addToPlaylist = new EventEmitter<Track>();
  @Output() removeTrack = new EventEmitter<Track>();
  @Output() download = new EventEmitter<Track>();

  /**
   * O botao de download so aparece quando o artista liberou o download e ha
   * quem trate o evento (faixas salvas sem o campo nao mostram o botao).
   */
  get canDownload(): boolean {
    return this.track.downloadable === true && this.download.observed;
  }

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

  onDownload(event: Event): void {
    event.stopPropagation();

    if (!this.downloading) {
      this.download.emit(this.track);
    }
  }

  onRemove(event: Event): void {
    event.stopPropagation();
    this.removeTrack.emit(this.track);
  }
}
