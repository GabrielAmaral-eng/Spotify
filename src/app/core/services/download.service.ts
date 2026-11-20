import { Injectable, inject } from '@angular/core';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { FileTransfer } from '@capacitor/file-transfer';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ToastController } from '@ionic/angular';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Track } from '../../shared/models/track.model';
import { AudiusService } from './audius.service';

/** Download em andamento: faixa e progresso (0–100, ou null se indefinido). */
export interface DownloadState {
  trackId: string;
  progress: number | null;
}

/** Pasta (dentro de Documents) onde o app salva as musicas no celular. */
const MOBILE_FOLDER = 'Melodix';

/** Depois desse tempo preparando, avisa que a conversao pode demorar. */
const SLOW_PREPARE_MS = 2500;

/** Link pronto para baixar, devolvido pela Edge Function (modo link=1). */
interface DownloadLink {
  url: string;
  fileName: string;
}

/**
 * Baixa faixas pela Edge Function download-track (Supabase), que confere se
 * o artista liberou o download e pede a Lambda de conversao (AWS) o MP3
 * 320 kbps "Artista - Titulo.mp3". A funcao responde, no modo link=1, um link
 * temporario do arquivo pronto (a primeira conversao pode levar ate ~1 min).
 *
 * - Web: pede o link (403 vira toast) e navega para ele; o
 *   Content-Disposition do link faz o navegador baixar sem sair da pagina.
 * - Android/iOS: pede o link e baixa com @capacitor/file-transfer para
 *   Documents/Melodix, oferecendo compartilhar/abrir com @capacitor/share.
 *
 * Nao exige login.
 */
@Injectable()
export class DownloadService {
  private readonly audiusService = inject(AudiusService);
  private readonly toastController = inject(ToastController);
  private readonly functionUrl = environment.downloadFunctionUrl;

  private readonly stateSubject = new BehaviorSubject<DownloadState | null>(null);
  /** Cache de "pode baixar?" para faixas salvas que nao trazem o campo. */
  private readonly downloadableCache = new Map<string, Observable<boolean>>();

  readonly state$ = this.stateSubject.asObservable();

  get isBusy(): boolean {
    return this.stateSubject.value !== null;
  }

  /**
   * Diz se a faixa pode ser baixada. Faixas da busca ja trazem o campo;
   * faixas salvas (favoritos/playlists) nao, entao consulta o backend.
   */
  isDownloadable(track: Track): Observable<boolean> {
    if (typeof track.downloadable === 'boolean') {
      return of(track.downloadable);
    }

    let cached = this.downloadableCache.get(track.id);

    if (!cached) {
      cached = this.audiusService.getTrack(track.id).pipe(
        map((fresh) => fresh.downloadable === true),
        catchError(() => of(false)),
        shareReplay(1)
      );
      this.downloadableCache.set(track.id, cached);
    }

    return cached;
  }

  async download(track: Track): Promise<void> {
    if (this.isBusy) {
      this.presentToast('Aguarde o download atual terminar.');
      return;
    }

    this.stateSubject.next({ trackId: track.id, progress: null });

    try {
      if (Capacitor.isNativePlatform()) {
        await this.downloadNative(track);
      } else {
        await this.downloadWeb(track);
      }
    } catch (error) {
      this.presentToast(this.errorMessage(error));
    } finally {
      this.stateSubject.next(null);
    }
  }

  private buildUrl(track: Track): string {
    return `${this.functionUrl}?id=${encodeURIComponent(track.id)}`;
  }

  // ---------------------------------------------------------------- Web ---

  private async downloadWeb(track: Track): Promise<void> {
    let link: DownloadLink;

    try {
      link = await this.requestLink(track);
    } catch (error) {
      if (error instanceof DownloadError) {
        throw error;
      }
      // Falha de rede/CORS ao pedir o link: a URL direta da funcao tambem
      // baixa (ela redireciona para o arquivo), so sem o aviso de 403.
      link = { url: this.buildUrl(track), fileName: '' };
    }

    // Navegar para uma resposta "attachment" nao sai da pagina: o navegador
    // so salva o arquivo. (<a download> nao serve para outra origem.)
    window.location.assign(link.url);
    this.presentToast('Download iniciado.');
  }

  /**
   * Pede a funcao o link do MP3 (converte na primeira vez). Erros HTTP viram
   * DownloadError com o status; um aviso aparece se a preparacao demorar.
   */
  private async requestLink(track: Track): Promise<DownloadLink> {
    let slowToast: HTMLIonToastElement | null = null;
    let finished = false;

    const slowTimer = setTimeout(() => {
      this.toastController
        .create({
          message: 'Preparando o MP3... na primeira vez pode levar até 1 minuto.',
          position: 'bottom'
        })
        .then((toast) => {
          if (finished) {
            return;
          }
          slowToast = toast;
          return toast.present();
        })
        .catch(() => undefined);
    }, SLOW_PREPARE_MS);

    try {
      const response = await fetch(`${this.buildUrl(track)}&link=1`, { cache: 'no-store' });

      if (!response.ok) {
        throw new DownloadError(response.status);
      }

      const body = (await response.json()) as { url?: string | null; fileName?: string | null };

      return {
        // url null = funcao sem conversor: baixa direto da propria funcao.
        url: body.url || this.buildUrl(track),
        fileName: body.fileName || this.fallbackFileName(track)
      };
    } finally {
      finished = true;
      clearTimeout(slowTimer);
      await (slowToast as HTMLIonToastElement | null)?.dismiss().catch(() => undefined);
    }
  }

  // ------------------------------------------------------- Android / iOS ---

  private async downloadNative(track: Track): Promise<void> {
    // O link ja vem com o nome final ("Artista - Titulo.mp3"); 403 vira toast.
    const { url, fileName } = await this.requestLink(track);
    await this.ensureStoragePermission();

    await Filesystem.mkdir({
      path: MOBILE_FOLDER,
      directory: Directory.Documents,
      recursive: true
    }).catch(() => undefined); // ja existe

    const path = await this.availablePath(fileName);
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Documents });

    let listener: PluginListenerHandle | null = null;

    try {
      listener = await FileTransfer.addListener('progress', (status) => {
        if (status.type !== 'download' || status.url !== url) {
          return;
        }

        const progress = status.lengthComputable && status.contentLength > 0
          ? Math.round((status.bytes / status.contentLength) * 100)
          : null;

        this.stateSubject.next({ trackId: track.id, progress });
      });

      await FileTransfer.downloadFile({ url, path: uri, progress: true });
    } finally {
      await listener?.remove();
    }

    await this.presentShareToast(track, uri, path);
  }

  /** Android 9 ou anterior pede permissao de escrita no armazenamento publico. */
  private async ensureStoragePermission(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    const current = await Filesystem.checkPermissions();
    if (current.publicStorage === 'granted') {
      return;
    }

    const requested = await Filesystem.requestPermissions();
    if (requested.publicStorage !== 'granted') {
      throw new Error('Permita o acesso ao armazenamento para salvar a música.');
    }
  }

  /** Evita sobrescrever: "Nome.mp3", "Nome (1).mp3", "Nome (2).mp3"... */
  private async availablePath(fileName: string): Promise<string> {
    const dot = fileName.lastIndexOf('.');
    const base = dot > 0 ? fileName.slice(0, dot) : fileName;
    const extension = dot > 0 ? fileName.slice(dot) : '';

    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = attempt === 0 ? fileName : `${base} (${attempt})${extension}`;
      const path = `${MOBILE_FOLDER}/${candidate}`;

      try {
        await Filesystem.stat({ path, directory: Directory.Documents });
      } catch {
        return path; // nao existe: livre
      }
    }

    return `${MOBILE_FOLDER}/${base} (${Date.now()})${extension}`;
  }

  /** Nome usado se a funcao nao informar um (nao deveria acontecer). */
  private fallbackFileName(track: Track): string {
    const raw = `${track.artist} - ${track.title}`.replace(/[\\/:*?"<>|]/g, '_').trim();
    return `${raw || 'faixa'}.mp3`;
  }

  private async presentShareToast(track: Track, uri: string, path: string): Promise<void> {
    const toast = await this.toastController.create({
      message: `Música salva em Documentos/${path}`,
      duration: 6000,
      position: 'bottom',
      buttons: [
        {
          text: 'Compartilhar',
          handler: () => {
            Share.share({
              title: `${track.artist} - ${track.title}`,
              files: [uri],
              dialogTitle: 'Abrir ou compartilhar música'
            }).catch(() => undefined); // usuario fechou a folha
          }
        }
      ]
    });

    await toast.present();
  }

  // -------------------------------------------------------------- Erros ---

  private errorMessage(error: unknown): string {
    const status = error instanceof DownloadError
      ? error.status
      : this.nativeHttpStatus(error);

    if (status === 403) {
      return 'O artista não liberou o download desta música.';
    }

    if (status === 404) {
      return 'Música não encontrada no Audius.';
    }

    if (status === 503) {
      return 'Ainda convertendo para MP3. Tente de novo em alguns segundos.';
    }

    if (status === 502 || status === 504) {
      return 'O Audius não respondeu agora. Tente novamente.';
    }

    if (error instanceof Error && error.message.startsWith('Permita')) {
      return error.message;
    }

    return 'Não foi possível baixar a música.';
  }

  /** Erros do file-transfer trazem o status HTTP em error.data.httpStatus. */
  private nativeHttpStatus(error: unknown): number | null {
    const data = (error as { data?: { httpStatus?: number } } | null)?.data;
    return typeof data?.httpStatus === 'number' ? data.httpStatus : null;
  }

  private presentToast(message: string): void {
    this.toastController
      .create({ message, duration: 2600, position: 'bottom' })
      .then((toast) => toast.present());
  }
}

class DownloadError extends Error {
  constructor(readonly status: number) {
    super(`Download falhou com status ${status}`);
  }
}
