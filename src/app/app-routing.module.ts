import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then((m) => m.LoginPageModule)
  },
  {
    path: 'home',
    loadChildren: () => import('./pages/home/home.module').then((m) => m.HomePageModule),
    canActivate: [authGuard]
  },
  {
    path: 'search',
    loadChildren: () => import('./pages/search/search.module').then((m) => m.SearchPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'player',
    loadChildren: () => import('./pages/player/player.module').then((m) => m.PlayerPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'playlists',
    loadChildren: () => import('./pages/playlist/playlist.module').then((m) => m.PlaylistPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'library',
    loadChildren: () => import('./pages/library/library.module').then((m) => m.LibraryPageModule),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: 'home',
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
