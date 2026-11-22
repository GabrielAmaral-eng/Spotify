import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

// Ouvir musica e publico; so playlists e biblioteca exigem conta.
const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./pages/login/login.module').then((m) => m.LoginPageModule)
  },
  {
    // Rota antiga: mantida para links salvos (os query params, como
    // returnUrl, sao preservados no redirecionamento).
    path: 'login',
    redirectTo: 'auth',
    pathMatch: 'full'
  },
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
