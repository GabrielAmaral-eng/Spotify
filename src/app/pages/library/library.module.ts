import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../../shared/shared.module';
import { LibraryPageRoutingModule } from './library-routing.module';
import { LibraryPage } from './library.page';

@NgModule({
  declarations: [LibraryPage],
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, LibraryPageRoutingModule]
})
export class LibraryPageModule {}
