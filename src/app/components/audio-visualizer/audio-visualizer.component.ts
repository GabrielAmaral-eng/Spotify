import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChildren,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import { PlayerService } from '../../core/services/player.service';

@Component({
  selector: 'app-audio-visualizer',
  templateUrl: './audio-visualizer.component.html',
  styleUrls: ['./audio-visualizer.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class AudioVisualizerComponent implements AfterViewInit, OnDestroy {
  /**
   * Quantidade de barras que compõem a onda. É recalculada automaticamente
   * para preencher a largura disponível (ver fillRatio); este valor é apenas
   * o ponto de partida até a primeira medição.
   */
  @Input() bars = 28;

  /** Fração da largura horizontal disponível que as barras devem ocupar. */
  @Input() fillRatio = 1;

  /** Quando false, a onda congela (animação pausada). */
  @Input() active = true;

  /**
   * "live" = visualizador real, dirigido pelo áudio (JS controla as barras).
   * Quando false, o CSS assume com a animação de onda (fallback).
   */
  live = false;

  @ViewChildren('barEl') private barEls!: QueryList<ElementRef<HTMLElement>>;

  // Opcional: em contextos sem PlayerService (ex.: teste isolado) cai no fallback.
  private readonly player = inject(PlayerService, { optional: true });
  private readonly zone = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private resizeObserver?: ResizeObserver;

  private analyser: AnalyserNode | null = null;
  private frequencyData: Uint8Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private subscription?: Subscription;

  // Detecção do node raro do Audius sem CORS: se o áudio toca mas as amostras
  // ficam zeradas por um tempo, desistimos do modo real e voltamos ao CSS.
  private silentFrames = 0;
  private sawSignal = false;
  private static readonly SILENCE_LIMIT = 120; // ~2s a 60fps

  /** Lista usada apenas para iterar no template. */
  get barList(): number[] {
    return Array.from({ length: this.bars }, (_, i) => i);
  }

  /**
   * Defasagem da animação por barra, criando o efeito de onda viajando.
   * Usada apenas no fallback CSS. Distribui um ciclo ao longo das barras.
   */
  delayFor(index: number): string {
    const cycle = 1.4; // duração de um ciclo da onda (s)
    const delay = -((index / this.bars) * cycle);
    return `${delay.toFixed(3)}s`;
  }

  ngAfterViewInit(): void {
    // Recalcula a quantidade de barras sempre que a largura disponível muda
    // (resize da janela, abrir/fechar painéis, etc.). O contentRect já exclui
    // o padding do host, então é exatamente o espaço útil para as barras.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        this.applyBarCount(entries[0]?.contentRect.width ?? 0);
      });
      this.resizeObserver.observe(this.host.nativeElement);
    }

    if (!this.player) {
      return; // sem serviço de áudio: permanece no fallback CSS
    }

    // Só começamos a "escutar" depois que o áudio realmente chegou — isto é,
    // tocando de fato (isPlaying) e fora do buffering (isLoading=false). Enquanto
    // carrega, o analyser só devolveria zeros; se começássemos antes, a detecção
    // de silêncio cairia no fallback antes mesmo da música começar.
    this.subscription = combineLatest([
      this.player.analyser$,
      this.player.isPlaying$,
      this.player.isLoading$,
    ]).subscribe(([analyser, isPlaying, isLoading]) => {
      this.analyser = analyser;
      if (analyser && (!this.frequencyData || this.frequencyData.length !== analyser.frequencyBinCount)) {
        this.frequencyData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      }

      const audioArrived = !!analyser && isPlaying && !isLoading;
      if (audioArrived) {
        this.startLiveLoop();
      } else {
        this.stopLiveLoop();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.resizeObserver?.disconnect();
    this.stopLiveLoop();
  }

  /**
   * Calcula quantas barras preenchem `fillRatio` (100%) da largura disponível e
   * atualiza `bars`. Para N barras de largura w com gap g entre elas:
   *   N*w + (N-1)*g = ratio*W  ⇒  N = (ratio*W + g) / (w + g)
   * Usamos floor, então o total fica sempre ≤ largura disponível — as barras
   * (centralizadas) nunca transbordam em direção à roda.
   */
  private applyBarCount(contentWidth: number): void {
    if (contentWidth <= 0) {
      return;
    }

    const styles = getComputedStyle(this.host.nativeElement);
    const barWidth = parseFloat(styles.getPropertyValue('--bar-width')) || 4;
    const gap = parseFloat(styles.getPropertyValue('--bar-gap')) || 6;
    const pitch = barWidth + gap;

    const count = Math.max(1, Math.floor((contentWidth * this.fillRatio + gap) / pitch));
    if (count !== this.bars) {
      // O callback do ResizeObserver pode rodar fora da zona; garantimos CD.
      this.zone.run(() => (this.bars = count));
    }
  }

  private startLiveLoop(): void {
    if (this.rafId !== null || !this.analyser) {
      return;
    }

    this.silentFrames = 0;
    this.sawSignal = false;

    // Atualizamos os estilos diretamente no DOM fora da zona do Angular para
    // não disparar change detection a cada frame.
    this.zone.run(() => (this.live = true));
    this.zone.runOutsideAngular(() => {
      const tick = (): void => {
        if (!this.renderFrame()) {
          return; // renderFrame já decidiu parar / cair no fallback
        }
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    });
  }

  private stopLiveLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.live) {
      this.zone.run(() => (this.live = false));
    }
  }

  /**
   * Lê o espectro e ajusta as barras. Retorna false quando o loop deve parar
   * (componente inativo ou silêncio persistente → fallback CSS).
   */
  private renderFrame(): boolean {
    const analyser = this.analyser;
    const data = this.frequencyData;
    const elements = this.barEls;

    if (!analyser || !data || !elements) {
      return false;
    }

    if (!this.active) {
      this.zone.run(() => (this.live = false));
      this.rafId = null;
      return false;
    }

    analyser.getByteFrequencyData(data);

    // Soma para detectar silêncio (node sem CORS devolve tudo zero).
    let total = 0;
    const bins = data.length;
    // Ignoramos os bins mais agudos, quase sempre vazios, concentrando as
    // barras na faixa audível mais expressiva.
    const usableBins = Math.max(1, Math.floor(bins * 0.85));

    elements.forEach((ref, i) => {
      const bin = Math.min(usableBins - 1, Math.floor((i / this.bars) * usableBins));
      const value = data[bin] / 255; // 0..1
      total += data[bin];
      // 0.12 mantém um piso visível; transform-origin/gradiente vêm do SCSS.
      const scale = 0.12 + value * 0.88;
      const el = ref.nativeElement;
      el.style.transform = `scaleY(${scale.toFixed(3)})`;
      el.style.opacity = (0.55 + value * 0.45).toFixed(3);
    });

    if (total > 0) {
      this.sawSignal = true;
    } else if (!this.sawSignal && ++this.silentFrames >= AudioVisualizerComponent.SILENCE_LIMIT) {
      // Áudio tocando mas sem amostras (provável CORS): desiste do modo real.
      this.zone.run(() => (this.live = false));
      this.rafId = null;
      return false;
    }

    return true;
  }
}
