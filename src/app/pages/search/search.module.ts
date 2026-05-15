import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { SearchPageRoutingModule } from './search-routing.module';
import { SearchPage } from './search.page';

@NgModule({
  declarations: [SearchPage],
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, SearchPageRoutingModule]
})
export class SearchPageModule {}
