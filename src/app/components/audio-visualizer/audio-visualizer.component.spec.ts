import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AudioVisualizerComponent } from './audio-visualizer.component';

describe('AudioVisualizerComponent', () => {
  let component: AudioVisualizerComponent;
  let fixture: ComponentFixture<AudioVisualizerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), NoopAnimationsModule, AudioVisualizerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AudioVisualizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
