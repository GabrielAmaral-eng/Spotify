import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject, of } from 'rxjs';

import { AppComponent } from './app.component';
import { PlayerService } from './core/services/player.service';

describe('AppComponent', () => {
  const playbackMessage$ = new Subject<string>();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        {
          provide: PlayerService,
          useValue: {
            playbackMessage$,
            currentTrack$: of(null)
          }
        },
        {
          provide: Router,
          useValue: {
            events: new Subject(),
            url: '/'
          }
        },
        {
          provide: ToastController,
          useValue: {
            create: jasmine.createSpy('create').and.resolveTo({
              present: jasmine.createSpy('present').and.resolveTo()
            })
          }
        }
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
