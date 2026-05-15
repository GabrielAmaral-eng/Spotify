import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PlaylistDetailPage } from './playlist-detail.page';
import { PlaylistListPage } from './playlist-list.page';

const routes: Routes = [
  {
    path: '',
    component: PlaylistListPage
  },
  {
    path: ':id',
    component: PlaylistDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PlaylistPageRoutingModule {}
