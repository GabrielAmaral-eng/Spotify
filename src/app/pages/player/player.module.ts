import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { PlayerPageRoutingModule } from './player-routing.module';
import { PlayerPage } from './player.page';

@NgModule({
  declarations: [PlayerPage],
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, PlayerPageRoutingModule]
})
export class PlayerPageModule {}
