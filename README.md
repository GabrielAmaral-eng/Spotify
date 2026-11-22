# 🎵 Melodix

Melodix é um aplicativo de streaming de música construído com **Ionic + Angular** no frontend e **Express + Node.js** no backend. Utiliza a API pública do [Audius](https://audius.co) como catálogo de músicas, o [Supabase](https://supabase.com) para autenticação e biblioteca pessoal, e duas funções **FaaS** (Supabase Edge Function + AWS Lambda) para o download de músicas em MP3.

Disponível como **aplicação web** e **app Android nativo** via Capacitor.

> A documentação técnica completa, em LaTeX, está em [`DOC/Doc_Melodix.tex`](DOC/Doc_Melodix.tex). Este README segue a mesma estrutura de capítulos, com foco no que mudou na versão atual e nas instruções de uso e publicação.

## Sumário

- [Apresentação](#apresentação)
- [1. Visão geral do sistema](#1-visão-geral-do-sistema)
- [2. Tecnologias, versões e ferramentas](#2-tecnologias-versões-e-ferramentas)
- [3. Arquitetura do frontend](#3-arquitetura-do-frontend)
- [4. Arquitetura do backend](#4-arquitetura-do-backend)
- [5. APIs e integrações externas](#5-apis-e-integrações-externas)
- [6. Download de músicas (FaaS)](#6-download-de-músicas-faas)
- [7. CORS e comunicação entre origens](#7-cors-e-comunicação-entre-origens)
- [8. Reprodução e streaming de áudio](#8-reprodução-e-streaming-de-áudio)
- [9. Visualização e análise de frequência](#9-visualização-e-análise-de-frequência)
- [10. Banco de dados e persistência](#10-banco-de-dados-e-persistência)
- [11. Segurança no backend, no banco e nas funções](#11-segurança-no-backend-no-banco-e-nas-funções)
- [12. Fluxos principais](#12-fluxos-principais)
- [13. Pontos de atenção e recomendações](#13-pontos-de-atenção-e-recomendações)
- [14. Inventário de arquivos relevantes](#14-inventário-de-arquivos-relevantes)
- [15. Conclusão](#15-conclusão)
- [Referências técnicas](#referências-técnicas)

---

## Apresentação

O Melodix reúne pesquisa, reprodução e download de músicas, com biblioteca pessoal opcional. O catálogo e o streaming vêm do Audius; a identidade e os dados da biblioteca ficam no Supabase (Auth + PostgreSQL).

Na versão atual:

- **Ouvir não exige conta.** A busca, o player e a tela inicial são públicos. O login é pedido apenas para ações que salvam dados: curtir, adicionar a playlists e abrir playlists/biblioteca.
- **Download em MP3 320 kbps** das faixas que o artista liberou no Audius, na Web e no app (Android/iOS). O download passa por uma **Supabase Edge Function** (`download-track`), que confere a permissão do artista, e por uma **AWS Lambda** (`melodix-mp3-converter`), que converte o arquivo original para MP3 e o guarda em cache no **Amazon S3**.

As versões citadas são as declaradas nos manifestos (`package.json`). Faixas com `^` ou `~` são intervalos semver, não a versão efetivamente instalada.

---

## 1. Visão geral do sistema

### 1.1 Objetivo e funcionalidades

- 🎧 **Ouvir sem conta** — busca e reprodução livres; conta só para playlists e favoritos
- 🔐 **Autenticação** — cadastro e login com e-mail/senha via Supabase Auth, na rota `/auth`, voltando para a tela anterior após o login
- 🪟 **Modal de login** — curtir, adicionar a playlist ou abrir playlists sem conta abre um modal ("Faça login para continuar") com atalho para `/auth`
- 🔍 **Busca de músicas** — pesquisa no catálogo do Audius com scroll infinito
- ▶️ **Player** — play/pause, anterior/próxima, progresso e volume
- ⬇️ **Download em MP3** — só para faixas com download liberado pelo artista (Web e Android/iOS)
- 🎨 **Visualizador de áudio** — Web Audio API, com fallback animado em CSS
- 📚 **Biblioteca pessoal** — playlists e músicas curtidas
- 📱 **Multiplataforma** — navegador e app Android via Capacitor

### 1.2 Limites funcionais observados

- O catálogo e os arquivos de áudio são do Audius. O projeto não hospeda o streaming: o navegador toca a música direto do Audius.
- A única cópia de áudio mantida pelo projeto é o **cache de MP3 convertidos para download**, no S3, que expira automaticamente (padrão: 30 dias).
- Só é possível baixar faixas em que o artista liberou o download (`is_downloadable`) **sem condições** (faixas que exigem seguir ou comprar, `is_download_gated`, não são oferecidas).
- A migração `20260518002513_spotify_connections.sql` cria uma tabela de conexões Spotify, mas não há fluxo OAuth do Spotify implementado.

### 1.3 Organização em camadas

1. **Frontend** — Angular e Ionic: telas, estado de reprodução, controle de acesso das ações de conta e chamadas HTTP.
2. **Backend** — API Express + TypeScript (Render): catálogo Audius (público) e biblioteca (autenticada).
3. **Funções FaaS** — Supabase Edge Function `download-track` (Deno) e AWS Lambda `melodix-mp3-converter` (Node.js + ffmpeg), com cache no S3.
4. **Serviços externos e persistência** — Audius (catálogo, stream e arquivo original para download), Supabase Auth e PostgreSQL.

```
Melodix/
├── src/                          # Frontend (Ionic + Angular)
│   ├── app/
│   │   ├── pages/                # home, search, library, playlist, player, login (/auth)
│   │   ├── components/           # player, audio-visualizer, playlists
│   │   ├── shared/               # mini-player, track-item, models, directives, pipes
│   │   └── core/                 # services, interceptors, guards
│   └── environments/
├── backend/                      # API Express + TypeScript
├── supabase/
│   ├── functions/download-track/ # Edge Function de download (Deno)
│   ├── migrations/               # Schema do banco
│   └── config.toml
├── aws/mp3-converter/            # Lambda de conversão para MP3 (AWS SAM)
├── DOC/Doc_Melodix.tex           # Documentação técnica (LaTeX)
├── android/                      # Projeto Android (Capacitor)
└── capacitor.config.ts
```

---

## 2. Tecnologias, versões e ferramentas

### 2.1 Frontend

| Dependência | Versão declarada | Responsabilidade |
|---|---|---|
| Angular | `^20.0.0` | Framework da aplicação cliente |
| Angular CLI | `20.3.26` | Compilação e ferramentas |
| Ionic Angular | `^8.0.0` | Componentes de interface (inclusive o modal de login) |
| RxJS | `~7.8.0` | Fluxos assíncronos e estado observável |
| TypeScript | `~5.9.0` | Tipagem e compilação |
| Capacitor Core / CLI | `8.3.4` | Ponte com recursos nativos e sincronização |
| `@capacitor/file-transfer` | `2.0.6` | Download do MP3 no app |
| `@capacitor/filesystem` | `8.1.5` | Pasta `Documents/Melodix` e permissões |
| `@capacitor/share` | `8.0.3` | Abrir/compartilhar o arquivo baixado |
| Supabase JS | `^2.105.4` | Cliente do Supabase |
| Ionicons | `^7.0.0` | Ícones |

### 2.2 Backend

| Dependência | Versão declarada | Responsabilidade |
|---|---|---|
| Express | `^4.21.2` | Servidor HTTP e rotas |
| TypeScript | `^5.7.2` | Tipagem e compilação |
| tsx | `^4.19.2` | Execução em desenvolvimento |
| Axios | `^1.7.9` | Requisições ao Audius |
| Supabase JS | `^2.105.4` | Auth e PostgreSQL |
| Zod | `^3.24.1` | Validação de ambiente e dados |
| cors / dotenv | `^2.8.5` / `^16.4.7` | CORS e variáveis de ambiente |

### 2.3 Funções FaaS

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Edge Function `download-track` | Supabase Edge Functions (Deno 2) | Confere a liberação do artista e entrega o link do MP3 |
| Lambda `melodix-mp3-converter` | AWS Lambda, Node.js 22, arm64 | Baixa o original, converte e guarda no S3 |
| Layer `melodix-ffmpeg` | ffmpeg 6.1.1 estático (via `ffmpeg-static` `5.3.0`) | Conversão para MP3 (libmp3lame) |
| `@aws-sdk/client-s3` / `s3-request-presigner` | `3.1173.0` | Gravação no S3 e links assinados |
| Amazon S3 | bucket privado | Cache dos MP3 convertidos |
| AWS SAM | `template.yaml` | Infraestrutura como código (opcional) |

### 2.4 Ambiente e execução local

**Pré-requisitos:** [Node.js](https://nodejs.org/) 18+ (22 recomendado), [Ionic CLI](https://ionicframework.com/docs/cli) (`npm install -g @ionic/cli`) e um projeto no [Supabase](https://supabase.com).

```bash
git clone https://github.com/GabrielAmaral-eng/Spotify.git
cd Spotify

# Frontend
npm install

# Backend
cd backend
npm install
cd ..
```

Crie o `backend/.env` a partir do exemplo:

```bash
cp backend/.env.example backend/.env
```

```env
PORT=3000
SUPABASE_URL="https://seu-projeto.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key"
AUDIUS_APP_NAME="Melodix"
FRONTEND_URL="http://localhost:8100"
```

```bash
# Terminal 1 — Backend (opcional: o frontend aponta para o Render por padrão)
npm run backend:dev

# Terminal 2 — Frontend
ionic serve
```

A aplicação fica em `http://localhost:8100`. Para usar o backend local, altere `apiUrl` em `src/environments/environment.ts` para `http://localhost:3000`.

As URLs usadas pelo frontend ficam em `src/environments/environment.ts` e `environment.prod.ts`: `apiUrl` (backend), `supabaseUrl`, `supabasePublishableKey` e `downloadFunctionUrl` (`<supabaseUrl>/functions/v1/download-track`).

### 2.5 Aplicativo Android

**Pré-requisitos:** [Android Studio](https://developer.android.com/studio), Android SDK (Android 14 ou 15) com Platform-Tools e Build-Tools.

```bash
# 1. Build de produção
ionic build --configuration production

# 2. Sincronizar com o Capacitor (inclui os plugins de download)
npx cap sync android
```

3. Crie/edite `android/local.properties`:

```properties
sdk.dir=C:\\Users\\SEU_USUARIO\\AppData\\Local\\Android\\Sdk
```

```bash
# 4. Gerar o APK
cd android
.\gradlew assembleDebug
```

O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`.

```bash
# 5. Instalar (emulador ou celular com depuração USB ativa)
C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r android\app\build\outputs\apk\debug\app-debug.apk
```

Para celular físico: Configurações → Sobre o telefone → toque 7× em "Número da versão"; depois Opções do desenvolvedor → Depuração USB.

**Download no Android:** os arquivos vão para `Documents/Melodix/`. Em Android 10, adicione `android:requestLegacyExternalStorage="true"` na tag `<application>`; em Android 9 ou anterior, a permissão de escrita (o app pede ao usuário). Em `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />
<application android:requestLegacyExternalStorage="true" ...>
```

**iOS:** para os arquivos aparecerem no app Arquivos, adicione ao `ios/App/App/Info.plist`:

```xml
<key>UIFileSharingEnabled</key>
<true/>
<key>LSSupportsOpeningDocumentsInPlace</key>
<true/>
```

---

## 3. Arquitetura do frontend

### 3.1 Estrutura de diretórios

```
src/app/
  pages/       home/ search/ library/ playlist/ player/ login/
  components/  player/ audio-visualizer/ playlists/
  core/        services/ interceptors/ guards/
  shared/      components/ models/ directives/ pipes/
```

### 3.2 CoreModule e injeção de dependências

`src/app/core/core.module.ts` registra `SupabaseService`, `AuthService`, `AccountGateService`, `AudiusService`, `DownloadService`, `PlayerService`, `PlaylistService` e o `ApiInterceptor` (`HTTP_INTERCEPTORS`, `multi: true`). O construtor com `@Optional() @SkipSelf()` impede a importação duplicada do módulo.

### 3.3 Serviços principais

| Serviço | Responsabilidade |
|---|---|
| `AudiusService` | Consulta `/audius/search` e `/audius/track/:id` no backend |
| `PlayerService` | Elemento `Audio`, estados de reprodução (`BehaviorSubject`/`Subject`) e grafo Web Audio |
| `AuthService` | Sessão do Supabase; expõe `isAuthenticated$`, reativo ao `onAuthStateChange` |
| `PlaylistService` | Playlists e favoritos; `syncWithSession()` carrega ao logar e limpa ao deslogar, sem chamar `/library` sem sessão |
| `AccountGateService` | Porteiro das ações de conta: sem sessão, abre o modal de login e leva a `/auth` guardando a rota atual |
| `DownloadService` | Pede o link do MP3 à Edge Function; na Web navega para ele, no app baixa com `file-transfer` e oferece compartilhar |

### 3.4 Rotas e acesso sem login

| Rota | Acesso | Observação |
|---|---|---|
| `/search` | Público | Rota padrão (`/` redireciona para cá) |
| `/home` | Público | Contadores de playlists/favoritos ficam em 0 sem sessão |
| `/player` | Público | Player em tela cheia |
| `/auth` | Público | Login e cadastro; aceita `?returnUrl=` para voltar à tela anterior |
| `/login` | — | Redireciona para `/auth`, preservando os parâmetros |
| `/playlists` | Requer login | `authGuard` leva a `/auth?returnUrl=/playlists` |
| `/library` | Requer login | `authGuard` leva a `/auth?returnUrl=/library` |

O `returnUrl` só aceita caminhos internos do app (começando com `/`); qualquer outro valor volta para `/search`.

### 3.5 Componentes de interface

- **Cabeçalho da busca:** visitantes veem o botão **"Entrar"** (ícone + texto); com sessão, o ícone de sair. Sair não interrompe a música, só limpa playlists e favoritos da tela.
- **Modal de login:** "Faça login para continuar — *Curtir músicas* precisa de login. Ouvir músicas continua liberado sem conta.", com os botões "Agora não" e "Entrar".
- **`PlayerComponent`:** play/pause, navegação, volume, progresso, curtir, adicionar a playlist e **baixar**. O botão de download fica desabilitado, com a dica "O artista não liberou download", quando a faixa não pode ser baixada; durante o download mostra carregamento e progresso.
- **`TrackItemComponent`:** botão de download (`@Output() download`) apenas para faixas com `downloadable === true`.
- **Tela de login:** link "Continuar sem conta" de volta à busca.

---

## 4. Arquitetura do backend

### 4.1 Estrutura de diretórios

```
backend/src/
  server.ts
  config/env.ts
  lib/supabase.ts
  middlewares/error.middleware.ts
  modules/
    auth/auth.middleware.ts
    audius/   (audius-http, controller, routes, service)
    library/  (controller, routes, schemas, service)
  types/track.ts
  utils/      (async-handler, http-error)
```

### 4.2 Configuração por ambiente

`backend/src/config/env.ts` valida `process.env` com Zod:

| Variável | Descrição |
|---|---|
| `PORT` | Porta (padrão 3000; o Render define sozinho) |
| `FRONTEND_URL` | URL do frontend liberada no CORS |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (secreta, só no servidor) |
| `AUDIUS_APP_NAME` | `app_name` enviado ao Audius (padrão `Melodix`) |

### 4.3 Publicação no Render

O backend roda no [Render](https://render.com) como Web Service:

| Configuração | Valor |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Branch | `main` (com Auto-Deploy ligado) |

As variáveis de ambiente são as da tabela 4.2. As variáveis do download (Lambda e Edge Function) **não** ficam no Render.

> No plano gratuito, o serviço dorme sem uso; a primeira requisição pode levar de 30 s a 1 min.

---

## 5. APIs e integrações externas

### 5.1 API interna (backend)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Estado do backend |
| GET | `/audius/search` | Pesquisa de faixas (pública) |
| GET | `/audius/track/:id` | Faixa por identificador (pública) |
| GET / POST | `/library/playlists` | Lista / cria playlists |
| GET / PUT / DELETE | `/library/playlists/:id` | Consulta / atualiza / exclui playlist |
| POST | `/library/playlists/:id/tracks` | Adiciona faixa |
| DELETE | `/library/playlists/:id/tracks/:trackId` | Remove faixa |
| GET / POST | `/library/favorites` | Lista / registra favoritos |
| DELETE | `/library/favorites/:trackId` | Remove favorito |

As rotas `/library` exigem o token Bearer (`authMiddleware`); as rotas `/audius` são públicas.

### 5.2 Integração Audius

O backend consulta `https://api.audius.co/v1/tracks/search` e `/v1/tracks/:id`, filtra faixas reproduzíveis e normaliza para o modelo `Track`:

```ts
interface Track {
  id: string; source: 'audius'; title: string; artist: string; album: string;
  thumbnail: string; duration: number; previewUrl: string | null;
  downloadable: boolean; // novo: is_downloadable === true && is_download_gated !== true
}
```

O `previewUrl` é o endpoint estável de stream (`/v1/tracks/{id}/stream?app_name=...`), usado só para **tocar**. Faixas salvas na biblioteca não guardam `downloadable`: quando necessário, o app consulta `/audius/track/:id`.

### 5.3 Supabase Auth

Login e cadastro por e-mail e senha. O backend valida o Bearer com `supabaseAuthClient.auth.getUser(token)`; token ausente ou inválido resulta em 401.

---

## 6. Download de músicas (FaaS)

### 6.1 Fluxo

```
App ──► Edge Function download-track (Supabase) ──► Lambda melodix-mp3-converter (AWS) ──► S3
        confere a liberação do artista             baixa o original e converte (ffmpeg)   cache dos MP3
```

1. O app pede `GET <SUPABASE_URL>/functions/v1/download-track?id=<trackId>&link=1`.
2. A Edge Function consulta a faixa no Audius: inexistente → `404`; artista não liberou → `403`.
3. Ela chama a Lambda (com segredo compartilhado). Na primeira vez, a Lambda baixa o **arquivo original** pelo endpoint oficial `/v1/tracks/{id}/download` (nunca pelo `/stream`), converte para **MP3 320 kbps** com tags de título/artista e grava em `s3://<bucket>/mp3/<trackId>.mp3`. Se o original já for MP3, é enviado sem reconverter.
4. A Lambda devolve um **link assinado** do S3 (válido por 15 min), já com `Content-Disposition: attachment; filename="Artista - Título.mp3"`.
5. O app baixa o arquivo desse link. Pedidos seguintes da mesma faixa usam o cache (resposta em menos de 1 s).

**Por que converter?** O `/download` do Audius entrega o arquivo que o artista enviou, que muitas vezes é FLAC ou WAV (às vezes com nome `.mp3`). O único MP3 pronto do Audius é o do `/stream`, que não é usado para download.

**Por que FaaS?** O download é um trabalho curto, sem estado e eventual: buscar metadados, validar a permissão do artista e entregar um arquivo. A Edge Function faz isso sob demanda, escala sozinha e não ocupa o backend no Render (sem conexões longas durante a transferência). Ela também resolve o que o navegador não consegue: o atributo `<a download>` é ignorado em URLs de outra origem, então só um servidor nosso consegue impor o nome "Artista - Título.mp3" e manter a regra de só baixar faixas liberadas num único lugar. A conversão fica numa segunda função, no AWS Lambda, porque é pesada em CPU: as Edge Functions têm poucos segundos de CPU por requisição, insuficiente para o ffmpeg converter uma faixa inteira. A Lambda permite até 15 min, até 10 GB de memória e disco em `/tmp`, e só é cobrada quando converte uma faixa nova.

### 6.2 Endpoints da Edge Function

```
GET  /functions/v1/download-track?id=<trackId>          → 302 para o MP3 (attachment)
GET  /functions/v1/download-track?id=<trackId>&link=1   → JSON { url, fileName } (usado pelo app)
HEAD /functions/v1/download-track?id=<trackId>          → só cabeçalhos (X-File-Name)
```

| Status | Quando |
|---|---|
| `200` / `302` | Faixa liberada; MP3 pronto |
| `400` | `id` inválido |
| `403` | Artista não liberou o download (`code: NOT_DOWNLOADABLE`) |
| `404` | Faixa não existe |
| `502` | Timeout ou erro do Audius/conversor |
| `503` | Primeira conversão passou de 120 s (`code: CONVERTING`); a Lambda termina em segundo plano e a próxima tentativa encontra o MP3 pronto |

Sem a Lambda configurada (`MP3_CONVERTER_URL` vazio), a função entrega o **arquivo original** em streaming, detectando o formato real pelos primeiros bytes. É o modo usado em desenvolvimento local sem AWS.

O download é público (`verify_jwt = false` em `supabase/config.toml`).

### 6.3 Secrets da Edge Function

| Variável | Descrição |
|---|---|
| `ALLOWED_ORIGINS` | Origens liberadas no CORS, separadas por vírgula (padrão: `http://localhost:8100,capacitor://localhost,http://localhost,https://localhost`) |
| `AUDIUS_APP_NAME` | `app_name` enviado ao Audius (padrão `Melodix`) |
| `MP3_CONVERTER_URL` | Function URL da Lambda. Vazio = entrega o original |
| `MP3_CONVERTER_SECRET` | Segredo compartilhado com a Lambda (mesmo valor de `CONVERTER_SECRET`) |

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase secrets set ALLOWED_ORIGINS="https://SEU-FRONT,http://localhost:8100,capacitor://localhost,http://localhost,https://localhost" AUDIUS_APP_NAME="Melodix"
npx supabase secrets set MP3_CONVERTER_URL="https://xxxx.lambda-url.<regiao>.on.aws/" MP3_CONVERTER_SECRET="<segredo>"
npx supabase functions deploy download-track
```

Se a função responder `401 Missing authorization header`, publique de novo com `--no-verify-jwt`.

**Rodar localmente** (Supabase CLI + Docker):

```bash
supabase start
supabase functions serve download-track --env-file supabase/functions/.env
curl -I "http://localhost:54321/functions/v1/download-track?id=<trackId>"
```

Sem Docker: `deno run --allow-net --allow-env supabase/functions/download-track/index.ts` (sobe em `http://localhost:8000/?id=<trackId>`). Para o front local usar a função local, aponte `downloadFunctionUrl` para ela.

### 6.4 Lambda de conversão (AWS)

Código em `aws/mp3-converter/` (TypeScript, Node.js 22, **arm64**):

| Recurso | Configuração |
|---|---|
| Função `melodix-mp3-converter` | Handler `handler.handler`, memória 2048 MB, timeout 5 min, `/tmp` de 4096 MB |
| Layer `melodix-ffmpeg` | `/opt/bin/ffmpeg` (arm64, Node.js 22.x) |
| Function URL | Auth `NONE` (protegida pelo header `x-converter-secret`), modo `BUFFERED`, sem CORS |
| Bucket S3 | Privado, na **mesma região** da função; regra de ciclo de vida expirando `mp3/` em 30 dias |

Variáveis de ambiente da Lambda:

| Variável | Valor |
|---|---|
| `BUCKET_NAME` | Nome do bucket S3 |
| `CONVERTER_SECRET` | Segredo com 32+ caracteres (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `AUDIUS_APP_NAME` | `Melodix` |
| `FFMPEG_PATH` | `/opt/bin/ffmpeg` |
| `URL_TTL_SECONDS` | `900` |

**Preparar os pacotes** (funciona no Windows):

```bash
npm install -g esbuild          # o sam build usa o esbuild global
cd aws/mp3-converter
npm ci
npm run layer:ffmpeg            # baixa o ffmpeg Linux arm64 em layers/ffmpeg/bin
```

**Opção A — AWS SAM** (cria tudo via CloudFormation; requer [AWS CLI](https://aws.amazon.com/cli/) e [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)):

```bash
sam build
sam deploy --guided   # informe região, ConverterSecret e aceite a Function URL sem autenticação
```

A saída `FunctionUrl` vira o `MP3_CONVERTER_URL`.

**Opção B — Console da AWS** (quando a conta bloqueia o CloudFormation, por exemplo por uma SCP da organização):

1. Gere os zips: `sam build`, depois o `function.zip` com o `handler.mjs` de `.aws-sam/build/Mp3ConverterFunction` e o `ffmpeg-layer.zip` com a pasta `bin/` de `layers/ffmpeg` (no Windows, use `tar.exe -a -c -f dist\ffmpeg-layer.zip -C layers\ffmpeg bin`, que grava os caminhos com `/`).
2. **S3:** crie o bucket (propósito geral, namespace global, acesso público bloqueado) na mesma região da função.
3. **Lambda → Camadas:** crie `melodix-ffmpeg` com o `ffmpeg-layer.zip`, arquitetura arm64, runtime Node.js 22.x.
4. **Lambda → Funções:** crie `melodix-mp3-converter` (Node.js 22.x, **arm64**), suba o `function.zip`, mude o manipulador para `handler.handler`, adicione a camada e ajuste memória, tempo limite e armazenamento temporário.
5. Configure as variáveis de ambiente e dê ao perfil da função acesso ao bucket (`s3:GetObject`/`s3:PutObject` em `mp3/*` e `s3:ListBucket` com prefixo `mp3/`).
6. Crie a URL da função (auth `NONE`, modo `BUFFERED`).

**Testar a Lambda:**

```bash
curl -i -H "x-converter-secret: <segredo>" "https://xxxx.lambda-url.<regiao>.on.aws/?id=<trackId>"
```

Resposta esperada: `200` com `{ "url", "fileName": "... .mp3", "cached" }`. Sem o segredo, `401`; faixa bloqueada, `403`. Erros aparecem em **Monitor → CloudWatch Logs**.

**Testar a conversão sem AWS:**

```bash
cd aws/mp3-converter
FFMPEG_PATH=/caminho/do/ffmpeg npm run convert:local -- <trackId>   # gera out/Artista - Título.mp3
npm run typecheck
```

### 6.5 No app

- **Web:** pede o link (`link=1`; 403 e 503 viram aviso), mostra "Preparando o MP3..." se a conversão demorar e navega para o link; o navegador baixa sem sair da página.
- **Android/iOS:** pede o link e baixa com `@capacitor/file-transfer` para `Documents/Melodix/`, com progresso, e oferece abrir/compartilhar com `@capacitor/share`.

---

## 7. CORS e comunicação entre origens

- **Backend (Express):** libera `FRONTEND_URL`, `http://localhost:8100`, `http://127.0.0.1:8100`, `capacitor://localhost`, `http://localhost`, `https://localhost` e IPs de rede privada na porta 8100.
- **Edge Function:** libera as origens de `ALLOWED_ORIGINS` e expõe `Content-Disposition`, `Content-Length`, `Content-Type` e `X-File-Name`. Sem a origem do front na lista, o navegador bloqueia o pedido do link; o app cai no plano B de abrir a função direto (o download ainda funciona, sem o aviso de faixa bloqueada).
- **Lambda e S3:** não precisam de CORS. A Lambda só é chamada pela Edge Function, e o S3 é acessado por navegação ou pelo download nativo.

CORS não é autenticação: ele só controla quais páginas podem ler as respostas no navegador.

---

## 8. Reprodução e streaming de áudio

O banco não guarda os bytes das músicas. O backend devolve metadados e o `previewUrl`; o `PlayerService` configura um `HTMLAudioElement` com essa URL e o navegador busca o áudio direto no Audius. Ouvir não exige conta.

Sequência: seleção da faixa → `PlayerService` atualiza a faixa atual → grafo Web Audio preparado na primeira reprodução → `play()` → eventos `waiting`/`playing`/`timeupdate`/`ended` atualizam a interface. O logout não interrompe a reprodução.

---

## 9. Visualização e análise de frequência

Grafo: `HTMLAudioElement → MediaElementAudioSourceNode → AnalyserNode → destination`, com `fftSize = 64` (32 bins) e `smoothingTimeConstant = 0.8`. A cada quadro (`requestAnimationFrame`, fora da zona do Angular), `getByteFrequencyData` alimenta as barras. Sem sinal por cerca de 120 quadros (por exemplo, sem cabeçalhos CORS no host de mídia), o componente volta ao fallback animado em CSS.

---

## 10. Banco de dados e persistência

A migração `20260517192304_auth_owned_library.sql` cria:

| Tabela | Conteúdo |
|---|---|
| `playlists` | Dono (`auth.users`), nome (1–80), descrição (até 240), capa, datas |
| `playlist_tracks` | Faixa por playlist: id Audius, metadados, `preview_url`, posição; único por `(playlist_id, track_id)` |
| `favorites` | Curtidas por usuário; único por `(user_id, track_id)` |

O que fica fora do banco:

- **Áudio:** continua no Audius.
- **MP3 convertidos para download:** ficam no S3, como cache temporário.
- **`downloadable`:** não é persistido; é consultado no Audius quando necessário.

---

## 11. Segurança no backend, no banco e nas funções

- **Bearer + RLS:** as rotas `/library` validam o token no Supabase Auth, e as operações usam um cliente com o token do usuário, submetido às políticas Row Level Security das três tabelas.
- **Frontend sem sessão:** nenhuma chamada a `/library` é feita sem login (`syncWithSession`); as ações de conta abrem o modal antes de qualquer requisição.
- **Chave de serviço do Supabase:** só no servidor (Render), nunca no frontend nem no repositório.
- **Edge Function pública** (`verify_jwt = false`): baixar não exige conta, mas a função só entrega faixas que o artista liberou e valida o `id`.
- **Lambda:** Function URL sem IAM, protegida pelo segredo `x-converter-secret` (comparação em tempo constante). A Lambda confere de novo a liberação do artista antes de converter, então mesmo com o segredo não converte faixas bloqueadas.
- **S3:** bucket privado com acesso público bloqueado; os arquivos só saem por links assinados que expiram em 15 min.
- **Segredos:** `CONVERTER_SECRET`/`MP3_CONVERTER_SECRET` ficam nas variáveis da Lambda e nos secrets do Supabase; `.env`, `samconfig.toml` e os zips de deploy estão no `.gitignore`.

---

## 12. Fluxos principais

### 12.1 Ouvir sem conta
1. O app abre em `/search`, sem login.
2. A busca consulta `/audius/search`; o player toca o `previewUrl` direto do Audius.
3. Nenhuma chamada a `/library` é feita enquanto não houver sessão.

### 12.2 Ação que exige conta
1. O visitante clica em curtir, adicionar a playlist ou abrir playlists.
2. O `AccountGateService` abre o modal "Faça login para continuar".
3. "Entrar" leva a `/auth?returnUrl=<tela atual>`.
4. Após o login, o app volta para a tela anterior e o `PlaylistService` carrega playlists e favoritos.

### 12.3 Download de uma faixa
1. O botão aparece só se `downloadable` for verdadeiro.
2. O `DownloadService` pede o link à Edge Function (`link=1`).
3. A Edge Function confere a liberação e chama a Lambda, que converte (só na primeira vez) e devolve o link do S3.
4. Na Web, o navegador baixa `Artista - Título.mp3`; no app, o arquivo vai para `Documents/Melodix/` e pode ser compartilhado.

### 12.4 Acesso à biblioteca
1. O frontend envia o token Bearer.
2. O middleware valida o token no Supabase Auth.
3. O serviço consulta o PostgreSQL com o token do usuário (RLS).
4. O backend devolve playlists e favoritos.

---

## 13. Pontos de atenção e recomendações

- **Primeira conversão:** pode levar de alguns segundos a ~1 min, principalmente pelo download do original no Audius. Depois a faixa sai do cache.
- **Render gratuito:** o backend dorme sem uso; a primeira busca do dia pode demorar.
- **Contas AWS de organização:** SCPs podem bloquear o CloudFormation (use o deploy pelo console, opção B) ou outros serviços.
- **Região:** bucket, camada e função devem ficar na mesma região.
- **Custo:** cada conversão nova consome segundos a ~1 min de Lambda com 2 GB, mais o armazenamento no S3; faixas já convertidas só custam a leitura.
- **Licença do ffmpeg:** o binário é GPL; a licença acompanha a camada em `bin/ffmpeg.LICENSE`.
- **Dependência do Audius:** indisponibilidade do Audius afeta busca, reprodução e downloads novos, sem que o backend esteja fora do ar.
- **Política CORS:** mantenha `ALLOWED_ORIGINS` e `FRONTEND_URL` alinhados com as origens realmente usadas.
- **Testes pendentes:** o download no Android/iOS ainda deve ser validado em aparelho.

---

## 14. Inventário de arquivos relevantes

| Arquivo ou diretório | Responsabilidade |
|---|---|
| `DOC/Doc_Melodix.tex` | Documentação técnica em LaTeX |
| `src/app/app-routing.module.ts` | Rotas públicas e protegidas, `/auth` e redirecionamento de `/login` |
| `src/app/core/guards/auth.guard.ts` | Proteção de `/playlists` e `/library` com `returnUrl` |
| `src/app/core/services/auth.service.ts` | Sessão e `isAuthenticated$` |
| `src/app/core/services/account-gate.service.ts` | Modal de login e navegação para `/auth` |
| `src/app/core/services/playlist.service.ts` | Biblioteca e `syncWithSession()` |
| `src/app/core/services/download.service.ts` | Download Web e nativo |
| `src/app/core/services/player.service.ts` | Reprodução e Web Audio |
| `src/app/components/player/` | Player, incluindo o botão de download |
| `src/app/shared/components/track-item/` | Item de faixa com curtir, playlist e download |
| `src/app/pages/search/` | Busca, roda de seleção e botão "Entrar" |
| `src/app/pages/login/` | Tela de login/cadastro (`/auth`) |
| `src/environments/` | URLs do backend, Supabase e função de download |
| `backend/src/modules/audius/` | Catálogo Audius e campo `downloadable` |
| `backend/src/modules/library/` | Playlists e favoritos |
| `backend/src/types/track.ts` | Modelos `Track` e `SavedTrack` |
| `supabase/functions/download-track/index.ts` | Edge Function de download |
| `supabase/config.toml` | Configuração do Supabase (`verify_jwt = false` da função) |
| `supabase/migrations/` | Tabelas, índices e RLS |
| `aws/mp3-converter/src/` | Lambda: handler, Audius e conversão |
| `aws/mp3-converter/template.yaml` | Infraestrutura AWS SAM |
| `aws/mp3-converter/scripts/` | Geração da camada do ffmpeg e teste local |
| `capacitor.config.ts` | Configuração do Capacitor |

---

## 15. Conclusão

O Melodix separa interface, API, funções FaaS, catálogo externo e persistência. Angular, Ionic e RxJS estruturam o cliente; Express fornece a API do catálogo e da biblioteca; Supabase Auth e PostgreSQL com RLS protegem os dados pessoais. Ouvir música é livre, e a conta só é pedida para salvar algo.

O download foi desenhado como FaaS em duas etapas: a Edge Function do Supabase aplica a regra do artista e entrega o arquivo, e a Lambda da AWS faz a conversão pesada para MP3, com cache no S3. Assim, o backend principal continua leve, cada faixa é convertida uma única vez e o usuário sempre recebe um MP3 com o nome "Artista - Título".

---

## Referências técnicas

- Angular: https://angular.dev/
- Ionic Framework: https://ionicframework.com/docs
- RxJS: https://rxjs.dev/
- Capacitor: https://capacitorjs.com/docs
- Capacitor File Transfer: https://capacitorjs.com/docs/apis/file-transfer
- Express: https://expressjs.com/
- Zod: https://zod.dev/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- AWS Lambda: https://docs.aws.amazon.com/lambda/
- AWS SAM: https://docs.aws.amazon.com/serverless-application-model/
- Amazon S3 (URLs pré-assinadas): https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html
- FFmpeg: https://ffmpeg.org/documentation.html
- Audius API: https://docs.audius.org/
- MDN Web Audio API: https://developer.mozilla.org/docs/Web/API/Web_Audio_API
- MDN CORS: https://developer.mozilla.org/docs/Web/HTTP/CORS

---

## 📄 Licença

Este projeto é de uso acadêmico/pessoal.
