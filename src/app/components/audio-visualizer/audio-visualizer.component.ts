import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-audio-visualizer',
  templateUrl: './audio-visualizer.component.html',
  styleUrls: ['./audio-visualizer.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class AudioVisualizerComponent {
  /** Quantidade de barras que compõem a onda. */
  @Input() bars = 28;

  /** Quando false, a onda congela (animação pausada). */
  @Input() active = true;

  /** Lista usada apenas para iterar no template. */
  get barList(): number[] {
    return Array.from({ length: this.bars }, (_, i) => i);
  }

  /**
   * Defasagem da animação por barra, criando o efeito de onda viajando.
   * Distribui um ciclo completo ao longo de todas as barras.
   */
  delayFor(index: number): string {
    const cycle = 1.4; // duração de um ciclo da onda (s)
    const delay = -((index / this.bars) * cycle);
    return `${delay.toFixed(3)}s`;
  }
}
