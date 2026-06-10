import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Aplicada ao texto interno de um titulo da roda. Quando o texto nao cabe no
 * container (sofre corte), desliza da direita para a esquerda ate o fim do
 * titulo, espera 0,3s, corta de volta para o inicio e repete.
 *
 * O container (.wheel-title) deve ter overflow:hidden e largura limitada.
 */
@Directive({
  selector: '[appWheelMarquee]',
  standalone: true
})
export class WheelMarqueeDirective implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  private resizeObserver?: ResizeObserver;
  private animation?: Animation;
  private debounceId?: ReturnType<typeof setTimeout>;

  /** Velocidade do deslize e pausa no fim, conforme pedido. */
  private readonly speedPxPerSec = 45;
  private readonly endPauseMs = 300;
  /** Duracao do fade out (no fim) e do fade in (ja no inicio). */
  private readonly fadeMs = 250;
  /** Largura do fade na borda (mantida igual ao mask do CSS). */
  private readonly fadePx = 24;

  ngOnInit(): void {
    // Fora do Angular para nao disparar deteccao de mudancas a cada resize.
    this.zone.runOutsideAngular(() => {
      const el = this.host.nativeElement;
      this.resizeObserver = new ResizeObserver(() => this.scheduleUpdate());
      this.resizeObserver.observe(el);
      if (el.parentElement) {
        this.resizeObserver.observe(el.parentElement);
      }
      this.scheduleUpdate();
    });
  }

  ngOnDestroy(): void {
    if (this.debounceId) {
      clearTimeout(this.debounceId);
    }
    this.resizeObserver?.disconnect();
    this.animation?.cancel();
  }

  /** Debounce: o titulo selecionado cresce com transicao de 0,3s; recalcula no fim. */
  private scheduleUpdate(): void {
    if (this.debounceId) {
      clearTimeout(this.debounceId);
    }
    this.debounceId = setTimeout(() => this.update(), 160);
  }

  private update(): void {
    const text = this.host.nativeElement;
    const container = text.parentElement;
    if (!container) {
      return;
    }

    this.animation?.cancel();
    this.animation = undefined;

    const overflow = container.scrollWidth - container.clientWidth;
    if (overflow <= 1) {
      return;
    }

    // Desliza um pouco alem do overflow para o fim do titulo passar do fade.
    const distance = overflow + this.fadePx;
    const slideMs = (distance / this.speedPxPerSec) * 1000;
    const totalMs = slideMs + this.endPauseMs + this.fadeMs * 2;

    // Sequencia: desliza ate o fim -> espera -> fade out (no fim) ->
    // corta para o inicio (invisivel) -> fade in (ja no inicio) -> repete.
    const slideEnd = slideMs / totalMs;
    const pauseEnd = (slideMs + this.endPauseMs) / totalMs;
    const fadeOutEnd = (slideMs + this.endPauseMs + this.fadeMs) / totalMs;

    this.animation = text.animate(
      [
        { offset: 0, transform: 'translateX(0px)', opacity: 1 },
        { offset: slideEnd, transform: `translateX(${-distance}px)`, opacity: 1 },
        { offset: pauseEnd, transform: `translateX(${-distance}px)`, opacity: 1 },
        { offset: fadeOutEnd, transform: `translateX(${-distance}px)`, opacity: 0 },
        { offset: fadeOutEnd, transform: 'translateX(0px)', opacity: 0 },
        { offset: 1, transform: 'translateX(0px)', opacity: 1 }
      ],
      { duration: totalMs, iterations: Infinity, easing: 'linear' }
    );
  }
}
