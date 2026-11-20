// Gera a layer do ffmpeg (Linux arm64, o mesmo da Lambda) em
// layers/ffmpeg/bin/ffmpeg, funcionando a partir de Windows, macOS ou Linux.
//
// Usa o pacote ffmpeg-static, que baixa um binario estatico (com libmp3lame)
// para a plataforma indicada em npm_config_platform / npm_config_arch.
//
//   npm run layer:ffmpeg            (arm64, padrao)
//   npm run layer:ffmpeg -- x64     (se mudar a arquitetura no template)

import { execSync } from 'node:child_process';
import { copyFileSync, chmodSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FFMPEG_STATIC_VERSION = '5.3.0';
const arch = process.argv[2] || 'arm64';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const binDir = join(root, 'layers', 'ffmpeg', 'bin');
const work = mkdtempSync(join(tmpdir(), 'ffmpeg-layer-'));

try {
  console.log(`Baixando ffmpeg-static ${FFMPEG_STATIC_VERSION} para linux-${arch}...`);

  execSync(`npm install --no-save --no-audit --no-fund ffmpeg-static@${FFMPEG_STATIC_VERSION}`, {
    cwd: work,
    stdio: 'inherit',
    env: { ...process.env, npm_config_platform: 'linux', npm_config_arch: arch }
  });

  const pkgDir = join(work, 'node_modules', 'ffmpeg-static');
  const binary = join(pkgDir, 'ffmpeg');

  if (!existsSync(binary)) {
    throw new Error('Binario do ffmpeg nao encontrado apos a instalacao.');
  }

  mkdirSync(binDir, { recursive: true });
  copyFileSync(binary, join(binDir, 'ffmpeg'));
  chmodSync(join(binDir, 'ffmpeg'), 0o755);

  // A licenca (GPL) acompanha o binario distribuido.
  for (const extra of ['ffmpeg.LICENSE', 'ffmpeg.README']) {
    if (existsSync(join(pkgDir, extra))) {
      copyFileSync(join(pkgDir, extra), join(binDir, extra));
    }
  }

  console.log(`Layer pronta em ${binDir}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
