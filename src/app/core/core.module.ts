import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule, Optional, SkipSelf } from '@angular/core';
import { ApiInterceptor } from './interceptors/api.interceptor';
import { PlayerService } from './services/player.service';
import { PlaylistService } from './services/playlist.service';
import { SessionService } from './services/session.service';
import { SpotifyService } from './services/spotify.service';

@NgModule({
  providers: [
    SessionService,
    SpotifyService,
    PlayerService,
    PlaylistService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiInterceptor,
      multi: true
    }
  ]
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule?: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule deve ser importado apenas no AppModule.');
    }
  }
}
