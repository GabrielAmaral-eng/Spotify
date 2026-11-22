// Teste local da conversao (sem AWS): baixa o original de uma faixa liberada
// e gera out/<Artista - Titulo>.mp3 com o mesmo codigo usado na Lambda.
//
//   FFMPEG_PATH=/caminho/do/ffmpeg npm run convert:local -- <trackId>

import { mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { downloadOriginal, fetchTrack, isDownloadable } from '../src/audius.js';
import { buildFileName, isMp3File, transcodeToMp3 } from '../src/convert.js';

const id = process.argv[2];

if (!id) {
  console.error('Uso: npm run convert:local -- <trackId>');
  process.exit(1);
}

const track = await fetchTrack(id);

if (!track) {
  console.error('Faixa nao encontrada.');
  process.exit(1);
}

if (!isDownloadable(track)) {
  console.error('O artista nao liberou o download desta faixa (seria 403).');
  process.exit(2);
}

const artist = track.user?.name?.trim() || 'Artista';
const outDir = join(process.cwd(), 'out');
await mkdir(outDir, { recursive: true });

const original = join(outDir, `${id}.original`);
const output = join(outDir, buildFileName(artist, track.title));

let started = Date.now();
if (!(await downloadOriginal(id, original))) {
  console.error('O Audius negou o download (seria 403).');
  process.exit(2);
}
console.log(`original: ${(await stat(original)).size} bytes em ${Date.now() - started} ms`);

if (await isMp3File(original)) {
  console.log('original ja e MP3: a Lambda envia sem reconverter.');
} else {
  started = Date.now();
  await transcodeToMp3(original, output, { artist, title: track.title });
  console.log(`mp3: ${(await stat(output)).size} bytes em ${Date.now() - started} ms -> ${output}`);
}

await rm(original, { force: true });
