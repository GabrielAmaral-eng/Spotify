# 🎵 Melodix

Melodix é um aplicativo de streaming de música construído com **Ionic + Angular** no frontend e **Express + Node.js** no backend. Utiliza a API pública do [Audius](https://audius.co) como catálogo de músicas e o [Supabase](https://supabase.com) para autenticação e gerenciamento de biblioteca pessoal.

Disponível como **aplicação web** e **app Android nativo** via Capacitor.

---

## ✨ Funcionalidades

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
└── capacitor.config.ts         # Configuração do Capacitor
```

---

## 🛠️ Tech Stack

| Camada     | Tecnologia                                  |
|------------|---------------------------------------------|
| Frontend   | Angular 20, Ionic 8, RxJS, TypeScript       |
| Backend    | Express 4, Node.js, TypeScript, Zod          |
| Auth & DB  | Supabase (Auth + PostgreSQL)                |
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

## 👥 Autores

- **Gabriel Amaral** — [@GabrielAmaral-eng](https://github.com/GabrielAmaral-eng)

---

## 📄 Licença

Este projeto é de uso acadêmico/pessoal.
