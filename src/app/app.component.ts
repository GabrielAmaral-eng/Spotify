import { Component, OnInit, inject } from '@angular/core';
import { SessionService } from './core/services/session.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private readonly sessionService = inject(SessionService);

  ngOnInit(): void {
    this.sessionService.initialize().catch((error: unknown) => {
      console.error('Não foi possível iniciar a sessão anônima:', error);
    });
  }
}
