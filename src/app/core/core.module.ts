import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule, Optional, SkipSelf } from '@angular/core';
import { ApiInterceptor } from './interceptors/api.interceptor';
import { AuthService } from './services/auth.service';
import { PlayerService } from './services/player.service';
import { PlaylistService } from './services/playlist.service';
import { AudiusService } from './services/audius.service';
import { SupabaseService } from './services/supabase.service';

@NgModule({
  providers: [
    SupabaseService,
    AuthService,
    AudiusService,
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
