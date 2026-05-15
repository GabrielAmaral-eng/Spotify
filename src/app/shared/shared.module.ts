import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { MiniPlayerComponent } from './components/mini-player/mini-player.component';
import { TrackItemComponent } from './components/track-item/track-item.component';
import { DurationPipe } from './pipes/duration.pipe';

@NgModule({
  declarations: [MiniPlayerComponent, TrackItemComponent, DurationPipe],
  imports: [CommonModule, IonicModule, RouterModule],
  exports: [
    MiniPlayerComponent,
    TrackItemComponent,
    DurationPipe,
    CommonModule,
    IonicModule
  ]
})
export class SharedModule {}
