# 🎵 Melodix

Melodix é um aplicativo de streaming de música construído com **Ionic + Angular** no frontend e **Express + Node.js** no backend. Utiliza a API pública do [Audius](https://audius.co) como catálogo de músicas e o [Supabase](https://supabase.com) para autenticação e gerenciamento de biblioteca pessoal.

Disponível como **aplicação web** e **app Android nativo** via Capacitor.

---

## ✨ Funcionalidades

- 🎧 **Ouvir sem conta** — Busca e reprodução são livres; o login só é pedido para playlists e favoritos
- ⬇️ **Download de músicas** — Baixa faixas que o artista liberou no Audius (Web e Android/iOS), via Supabase Edge Function
- 🔐 **Autenticação** — Cadastro e login com e-mail/senha via Supabase Auth
- 🔍 **Busca de músicas** — Pesquisa no catálogo do Audius com scroll infinito
- ▶️ **Player de música** — Reprodução com controles de play/pause, anterior/próximo, barra de progresso e volume
- 🎨 **Visualizador de áudio** — Visualização em tempo real usando Web Audio API (com fallback em CSS)
- 📚 **Biblioteca pessoal** — Crie e gerencie playlists com suas músicas favoritas
- 📱 **Multiplataforma** — Roda no navegador e como app Android nativo

---

## 🏗️ Arquitetura

```
Melodix/
├── src/                        # Frontend (Ionic + Angular)
│   ├── app/
│   │   ├── pages/              # Páginas da aplicação
│   │   │   ├── home/           # Tela inicial
│   │   │   ├── search/         # Busca de músicas
│   │   │   ├── library/        # Biblioteca do usuário
│   │   │   ├── playlist/       # Detalhes da playlist
│   │   │   ├── player/         # Player em tela cheia
│   │   │   └── login/          # Autenticação
│   │   ├── components/         # Componentes globais
│   │   │   ├── player/         # Player principal
│   │   │   ├── audio-visualizer/ # Visualizador de áudio
│   │   │   └── playlists/      # Listagem de playlists
│   │   ├── shared/             # Módulos compartilhados
│   │   │   ├── components/     # Mini-player, track-item
│   │   │   ├── models/         # Interfaces (Track, Playlist)
│   │   │   ├── directives/     # Diretivas customizadas
│   │   │   └── pipes/          # Pipes customizados
│   │   └── core/               # Serviços e interceptors
│   │       ├── services/       # Auth, Player, Playlist, Audius, Supabase
│   │       └── interceptors/   # Interceptor de API
│   └── environments/           # Configurações de ambiente
├── backend/                    # Backend (Express + Node.js)
│   └── src/
│       ├── server.ts           # Entrada da aplicação
│       ├── config/             # Variáveis de ambiente (Zod)
│       ├── middlewares/        # Middleware de erro
│       ├── modules/
│       │   ├── audius/         # Proxy para API do Audius
│       │   ├── library/        # CRUD de playlists (Supabase)
│       │   └── auth/           # Autenticação
│       └── utils/              # Utilitários
├── android/                    # Projeto Android (Capacitor)
├── supabase/                   # Configurações do Supabase
│   ├── functions/download-track/ # Edge Function de download (Deno)
│   └── migrations/             # Schema do banco
└── capacitor.config.ts         # Configuração do Capacitor
```

---

## 🛠️ Tech Stack

| Camada     | Tecnologia                                  |
|------------|---------------------------------------------|
| Frontend   | Angular 20, Ionic 8, RxJS, TypeScript       |
| Backend    | Express 4, Node.js, TypeScript, Zod          |
| Auth & DB  | Supabase (Auth + PostgreSQL)                |
| FaaS       | Supabase Edge Functions (Deno)              |
| Música     | Audius API (catálogo público e gratuito)     |
| Mobile     | Capacitor 8 (Android)                       |
| Hosting    | Render (backend)                            |

---

## 🚀 Rodando Localmente (PC)

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [Ionic CLI](https://ionicframework.com/docs/cli): `npm install -g @ionic/cli`
- Conta no [Supabase](https://supabase.com) (projeto já configurado)

### 1. Clonar o repositório

```bash
git clone https://github.com/GabrielAmaral-eng/Spotify.git
cd Spotify
```

### 2. Instalar dependências

```bash
# Frontend
npm install

# Backend
cd backend
npm install
cd ..
```

### 3. Configurar variáveis de ambiente do backend

Crie o arquivo `backend/.env` baseado no exemplo:

```bash
cp backend/.env.example backend/.env
```

Preencha as variáveis:

```env
PORT=3000
SUPABASE_URL="https://seu-projeto.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key"
AUDIUS_APP_NAME="Melodix"
FRONTEND_URL="http://localhost:8100"
```

### 4. Iniciar a aplicação

```bash
# Terminal 1 — Backend (se estiver rodando localmente)
npm run backend:dev

# Terminal 2 — Frontend
ionic serve
```

A aplicação estará disponível em `http://localhost:8100`.

> **Nota:** O backend também está hospedado no Render. Se preferir usar o backend remoto, não é necessário rodar o Terminal 1 — o frontend já aponta para a URL do Render por padrão.

---

## 📱 Instalando no Android

### Pré-requisitos

- [Android Studio](https://developer.android.com/studio) instalado
- Android SDK configurado (SDK Platforms: Android 14 ou 15)
- SDK Tools instaladas:
  - Android SDK Platform-Tools
  - Android SDK Build-Tools
  - Android Emulator (opcional, para testes)

### 1. Build de produção

```bash
ionic build --configuration production
```

### 2. Sincronizar com Capacitor

```bash
npx cap sync android
```

### 3. Configurar o SDK path

Crie/edite o arquivo `android/local.properties`:

```properties
sdk.dir=C:\\Users\\SEU_USUARIO\\AppData\\Local\\Android\\Sdk
```

### 4. Gerar o APK

```bash
cd android
.\gradlew assembleDebug
```

O APK será gerado em:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 5. Instalar no emulador

```bash
# Listar dispositivos conectados
C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk\platform-tools\adb.exe devices

# Instalar o APK
C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r android\app\build\outputs\apk\debug\app-debug.apk
```

### 6. Instalar no celular físico

1. **Habilite o modo desenvolvedor** no celular:
   - Configurações → Sobre o telefone → toque 7x em "Número da versão"
2. **Ative a Depuração USB**:
   - Configurações → Sistema → Opções do desenvolvedor → Depuração USB
3. **Conecte o celular** via USB e aceite a depuração
4. **Verifique a conexão**:
   ```bash
   C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
   ```
5. **Instale o APK**:
   ```bash
   C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r android\app\build\outputs\apk\debug\app-debug.apk
   ```

> **Dica:** Se houver apenas um dispositivo conectado, o `-s ID_DISPOSITIVO` é opcional.

---

## 🌐 Backend no Render

O backend está hospedado no [Render](https://render.com) como um Web Service.

| Configuração     | Valor                        |
|------------------|------------------------------|
| Root Directory   | `backend`                    |
| Build Command    | `npm install && npm run build` |
| Start Command    | `npm start`                  |
| Runtime          | Node                         |

### Variáveis de ambiente necessárias

| Variável                   | Descrição                              |
|----------------------------|----------------------------------------|
| `SUPABASE_URL`             | URL do projeto Supabase                |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase              |
| `SUPABASE_SERVICE_ROLE_KEY`| Chave de serviço (secreta) do Supabase |
| `AUDIUS_APP_NAME`          | Nome do app para a API do Audius       |
| `FRONTEND_URL`             | URL do frontend para CORS              |

> `PORT` é definido automaticamente pelo Render — não é necessário configurar.

---

## ⬇️ Download de músicas (Supabase Edge Function)

O download é feito pela Edge Function `download-track` (`supabase/functions/download-track/index.ts`):

```
GET  <SUPABASE_URL>/functions/v1/download-track?id=<trackId>   → arquivo (attachment)
HEAD <SUPABASE_URL>/functions/v1/download-track?id=<trackId>   → só cabeçalhos (pré-checagem)
```

1. Consulta a faixa no Audius. Se não existir → `404`. Se o artista não liberou o download (`is_downloadable` falso, ou download condicionado a seguir/comprar) → `403` com JSON explicando.
2. Baixa pelo endpoint oficial `/v1/tracks/{id}/download` (nunca pelo `/stream`) e devolve o arquivo **em streaming** com `Content-Disposition: attachment; filename="Artista - Título.ext"` (nome sanitizado, com `filename*` em UTF-8).
3. O Audius entrega o **arquivo original** do artista e às vezes o rotula como `.mp3` mesmo sendo FLAC ou WAV. A função lê os primeiros bytes e usa a extensão e o `Content-Type` reais.
4. Timeout ou erro do Audius → `502` em JSON.

O download é público (não exige login): `verify_jwt = false` em `supabase/config.toml`.

### Por que uma função FaaS?

O download é um trabalho curto, sem estado e que acontece de vez em quando: buscar metadados, validar a permissão do artista e repassar um arquivo. Uma Edge Function roda isso sob demanda, perto do usuário, escala sozinha e não ocupa o backend Express no Render, que fica livre para a API da biblioteca (e não precisa manter conexões longas abertas enquanto um arquivo de dezenas de MB é transferido). A função também resolve o que o navegador não consegue sozinho: o atributo `<a download>` é ignorado em URLs de outra origem, então só um servidor nosso pode mandar o `Content-Disposition` com o nome "Artista - Título" e manter a regra de só baixar faixas liberadas num lugar só.

### Secrets

| Variável          | Descrição                                                                 | Padrão |
|-------------------|---------------------------------------------------------------------------|--------|
| `ALLOWED_ORIGINS` | Origens liberadas no CORS, separadas por vírgula                          | `http://localhost:8100,capacitor://localhost,http://localhost,https://localhost` |
| `AUDIUS_APP_NAME` | `app_name` enviado ao Audius                                              | `Melodix` |

```bash
supabase secrets set ALLOWED_ORIGINS="https://SEU-FRONT.onrender.com,http://localhost:8100,capacitor://localhost,http://localhost,https://localhost" AUDIUS_APP_NAME="Melodix"
```

### Rodando localmente

Requer a [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) e Docker.

```bash
# variáveis locais da função (opcional)
echo 'ALLOWED_ORIGINS=http://localhost:8100,capacitor://localhost,http://localhost,https://localhost' > supabase/functions/.env

supabase start
supabase functions serve download-track --env-file supabase/functions/.env
```

Teste:

```bash
# faixa liberada → 200 com Content-Disposition
curl -I "http://localhost:54321/functions/v1/download-track?id=<trackId>"

# faixa sem download liberado → 403
curl "http://localhost:54321/functions/v1/download-track?id=<trackId>"
```

Sem Docker, dá para rodar só a função com o [Deno](https://deno.com): `deno run --allow-net --allow-env supabase/functions/download-track/index.ts` (sobe em `http://localhost:8000/?id=<trackId>`).

Para o front local usar a função local, aponte `downloadFunctionUrl` em `src/environments/environment.ts` para ela.

### Deploy

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy download-track
```

O `verify_jwt = false` do `config.toml` é aplicado no deploy (equivale a `--no-verify-jwt`).

### No app (Capacitor)

- **Web:** o app confere a faixa com `HEAD` (mostra o 403 num toast) e abre a URL da função; o navegador baixa o arquivo.
- **Android/iOS:** `@capacitor/file-transfer` baixa para `Documents/Melodix/` (com progresso) e, ao terminar, oferece compartilhar/abrir com `@capacitor/share`.

Depois de instalar dependências, sincronize os projetos nativos:

```bash
npx cap sync
```

**Android:** em Android 10, salvar em `Documents` exige `android:requestLegacyExternalStorage="true"` na tag `<application>`; em Android 9 ou anterior, a permissão de escrita (o app pede ao usuário). Em `android/app/src/main/AndroidManifest.xml`:

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

## 📄 Licença

Este projeto é de uso acadêmico/pessoal.
