import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { PlaylistPageRoutingModule } from './playlist-routing.module';
import { PlaylistDetailPage } from './playlist-detail.page';
import { PlaylistListPage } from './playlist-list.page';

@NgModule({
  declarations: [PlaylistListPage, PlaylistDetailPage],
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, PlaylistPageRoutingModule]
})
export class PlaylistPageModule {}
