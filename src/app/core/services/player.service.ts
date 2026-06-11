import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Track } from '../../shared/models/track.model';

@Injectable()
export class PlayerService {
  private readonly audio = new Audio();
  private readonly currentTrackSubject = new BehaviorSubject<Track | null>(null);
  private readonly isPlayingSubject = new BehaviorSubject<boolean>(false);
  private readonly progressSubject = new BehaviorSubject<number>(0);
  private readonly isLoadingSubject = new BehaviorSubject<boolean>(false);
  private readonly playbackMessageSubject = new Subject<string>();
  private readonly skipPreviousSubject = new Subject<void>();
  private readonly skipNextSubject = new Subject<void>();
  private readonly volumeSubject = new BehaviorSubject<number>(50);
  private readonly analyserSubject = new BehaviorSubject<AnalyserNode | null>(null);

  // Grafo Web Audio para o visualizador real. Montado uma unica vez, no
  // primeiro play (dentro do gesto do usuario, respeitando o autoplay policy).
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private audioGraphInitialized = false;

  readonly currentTrack$: Observable<Track | null> = this.currentTrackSubject.asObservable();
  readonly isPlaying$: Observable<boolean> = this.isPlayingSubject.asObservable();
  readonly progress$: Observable<number> = this.progressSubject.asObservable();
  readonly isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  readonly playbackMessage$: Observable<string> = this.playbackMessageSubject.asObservable();
  // Pedidos de faixa anterior/proxima — quem mantem a fila (a roda na busca) reage.
  readonly skipPrevious$: Observable<void> = this.skipPreviousSubject.asObservable();
  readonly skipNext$: Observable<void> = this.skipNextSubject.asObservable();
  /** Volume da reproducao em porcentagem (0–100), padrao 50%. */
  readonly volume$: Observable<number> = this.volumeSubject.asObservable();
  /**
   * AnalyserNode do Web Audio para o visualizador. Emite o no quando o grafo
   * e montado com sucesso; permanece null se o Web Audio nao estiver
   * disponivel (ai o visualizador cai no fallback animado por CSS).
   */
  readonly analyser$: Observable<AnalyserNode | null> = this.analyserSubject.asObservable();

  constructor() {
    // Necessario para o AnalyserNode ler amostras de um stream de outra origem
    // (Audius). Sem isso o elemento fica "tainted" e o analyser le so zeros.
    this.audio.crossOrigin = 'anonymous';

    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => {
      this.isPlayingSubject.next(false);
      this.isLoadingSubject.next(false);
      this.progressSubject.next(100);
    });
    // Enquanto o stream carrega/bufferiza, sinalizamos "carregando"; quando a
    // reproducao realmente comeca, o spinner sai e o estado vira "tocando".
    this.audio.addEventListener('waiting', () => this.isLoadingSubject.next(true));
    this.audio.addEventListener('playing', () => {
      this.isLoadingSubject.next(false);
      this.isPlayingSubject.next(true);
    });
    this.audio.volume = this.volumeSubject.value / 100;
  }

  get currentVolume(): number {
    return this.volumeSubject.value;
  }

  /** Define o volume (0–100); reflete no elemento de audio da pagina. */
  setVolume(percent: number): void {
    const clamped = Math.min(100, Math.max(0, Math.round(percent)));
    this.audio.volume = clamped / 100;
    this.volumeSubject.next(clamped);
  }

  play(track: Track): void {
    const currentTrack = this.currentTrackSubject.value;

    if (currentTrack?.id !== track.id) {
      this.progressSubject.next(0);
      this.currentTrackSubject.next(track);
    }

    this.startPlayback(track);
  }

  /**
   * Monta (uma unica vez) o grafo audio->analyser->saida e o mantem resumido.
   * Deve ser chamado dentro de um gesto do usuario. Em qualquer falha (Web
   * Audio indisponivel, elemento sem CORS, etc.) o analyser fica null e o
   * visualizador usa o fallback animado por CSS.
   */
  private ensureAudioGraph(): void {
    if (!this.audioGraphInitialized) {
      this.audioGraphInitialized = true;
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

        if (Ctor) {
          this.audioContext = new Ctor();
          // createMediaElementSource so pode ser chamado uma vez por elemento;
          // por isso este metodo e idempotente (guarda audioGraphInitialized).
          this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
          this.analyserNode = this.audioContext.createAnalyser();
          this.analyserNode.fftSize = 64;
          this.analyserNode.smoothingTimeConstant = 0.8;
          this.sourceNode.connect(this.analyserNode);
          this.analyserNode.connect(this.audioContext.destination);
          this.analyserSubject.next(this.analyserNode);
        }
      } catch (error: unknown) {
        console.warn('Visualizador real indisponivel; usando fallback CSS.', error);
        this.audioContext = null;
        this.sourceNode = null;
        this.analyserNode = null;
        this.analyserSubject.next(null);
      }
    }

    // O contexto nasce "suspended" ate o gesto do usuario; retomamos aqui.
    if (this.audioContext?.state === 'suspended') {
      void this.audioContext.resume();
    }
  }

  private startPlayback(track: Track): void {
    if (!track.previewUrl) {
      this.clearAudio();
      this.isLoadingSubject.next(false);
      this.isPlayingSubject.next(false);
      this.progressSubject.next(0);
      this.playbackMessageSubject.next('Esta musica nao esta disponivel para reproducao.');
      return;
    }

    this.ensureAudioGraph();
    this.audio.src = track.previewUrl;

    // Estado otimista: ja indicamos "carregando + tocando" no ato da selecao,
    // antes de o stream terminar de carregar. O spinner aparece imediatamente
    // e some quando a reproducao realmente comeca (evento 'playing').
    this.isLoadingSubject.next(true);
    this.isPlayingSubject.next(true);

    this.audio.play()
      .then(() => this.isPlayingSubject.next(true))
      .catch((error: unknown) => this.handlePlaybackError(error));
  }

  pause(): void {
    this.audio.pause();
    this.isPlayingSubject.next(false);
    this.isLoadingSubject.next(false);
  }

  /**
   * Encerra a reproducao por completo e zera a faixa atual. Usado no logout
   * para que o mini-player nao continue na tela de login com uma musica
   * "tocando".
   */
  stop(): void {
    this.audio.pause();
    this.clearAudio();
    this.currentTrackSubject.next(null);
    this.isPlayingSubject.next(false);
    this.isLoadingSubject.next(false);
    this.progressSubject.next(0);
  }

  /** Pede a faixa anterior (uma para cima na roda). */
  requestPrevious(): void {
    this.skipPreviousSubject.next();
  }

  /** Pede a proxima faixa (uma para baixo na roda). */
  requestNext(): void {
    this.skipNextSubject.next();
  }

  toggle(): void {
    if (!this.currentTrackSubject.value) {
      return;
    }

    if (this.audio.paused) {
      this.ensureAudioGraph();
      this.audio.play()
        .then(() => this.isPlayingSubject.next(true))
        .catch((error: unknown) => this.handlePlaybackError(error));
      return;
    }

    this.pause();
  }

  seekToPercent(percent: number): void {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
      return;
    }

    this.audio.currentTime = (this.audio.duration * percent) / 100;
  }

  private updateProgress(): void {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
      this.progressSubject.next(0);
      return;
    }

    const progress = (this.audio.currentTime / this.audio.duration) * 100;
    this.progressSubject.next(Math.min(100, Math.max(0, progress)));
  }

  private clearAudio(): void {
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  private handlePlaybackError(error: unknown): void {
    // O play() rejeita com AbortError quando a reproducao e interrompida por
    // uma nova faixa ou por um pause antes de o audio terminar de carregar.
    // Isso nao e uma falha real, entao ignoramos silenciosamente.
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    console.error('Falha ao reproduzir a musica:', error);
    this.isLoadingSubject.next(false);
    this.isPlayingSubject.next(false);
    this.playbackMessageSubject.next('Nao foi possivel reproduzir esta musica.');
  }
}
