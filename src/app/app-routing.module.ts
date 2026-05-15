import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./pages/home/home.module').then((m) => m.HomePageModule)
  },
  {
    path: 'search',
    loadChildren: () => import('./pages/search/search.module').then((m) => m.SearchPageModule)
  },
  {
    path: 'player',
    loadChildren: () => import('./pages/player/player.module').then((m) => m.PlayerPageModule)
  },
  {
    path: 'playlists',
    loadChildren: () => import('./pages/playlist/playlist.module').then((m) => m.PlaylistPageModule)
  },
  {
    path: 'library',
    loadChildren: () => import('./pages/library/library.module').then((m) => m.LibraryPageModule)
  },
  {
    path: '',
    redirectTo: 'search',
    pathMatch: 'full'
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
