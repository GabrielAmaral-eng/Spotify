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

/**
 * Baixa faixas pela Edge Function download-track (Supabase), que confere se
 * o artista liberou o download e devolve o arquivo com o nome
 * "Artista - Titulo.ext".
 *
 * - Web: confere a faixa com HEAD (para mostrar o 403 num toast) e navega
 *   para a URL da funcao; o Content-Disposition faz o navegador baixar.
 * - Android/iOS: baixa com @capacitor/file-transfer para Documents/Melodix e
 *   oferece compartilhar/abrir com @capacitor/share.
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
    const url = this.buildUrl(track);

    // Pre-checagem: um 403/404 vira toast em vez de abrir uma pagina JSON.
    // Se a checagem em si falhar (rede/CORS), tenta o download mesmo assim.
    const status = await this.headStatus(url);
    if (status !== null && status !== 200) {
      throw new DownloadError(status);
    }

    // Navegar para uma resposta "attachment" nao sai da pagina: o navegador
    // so salva o arquivo. (<a download> nao serve para outra origem.)
    window.location.assign(url);
    this.presentToast('Download iniciado.');
  }

  private async headStatus(url: string): Promise<number | null> {
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return response.status;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------- Android / iOS ---

  private async downloadNative(track: Track): Promise<void> {
    const url = this.buildUrl(track);

    // O HEAD confirma a liberacao e traz o nome com a extensao real do
    // arquivo (o original do artista pode ser FLAC/WAV, nao so mp3).
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
    if (head && head.status !== 200) {
      throw new DownloadError(head.status);
    }

    const fileName = this.fileNameFrom(head, track);
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

  private fileNameFrom(head: Response | null, track: Track): string {
    const header = head?.headers.get('X-File-Name');

    if (header) {
      try {
        return decodeURIComponent(header);
      } catch {
        // cai no nome montado abaixo
      }
    }

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

    if (status === 502 || status === 503 || status === 504) {
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
