import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { PlayerPageRoutingModule } from './player-routing.module';
import { PlayerPage } from './player.page';
import { PlayerComponent } from '../../components/player/player.component';

@NgModule({
  declarations: [PlayerPage],
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, PlayerPageRoutingModule, PlayerComponent]
})
export class PlayerPageModule {}
