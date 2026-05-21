import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { libraryRouter } from './modules/library/library.routes';
import { spotifyRouter } from './modules/spotify/spotify.routes';
import { tokenService } from './modules/spotify/token.service';

const app = express();
const port = env.PORT;
const frontendUrl = env.FRONTEND_URL;

app.use(
  cors({
    origin: frontendUrl,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'melodix-backend' });
});

app.use('/library', libraryRouter);
app.use('/spotify', spotifyRouter);
app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`Melodix backend ouvindo em http://localhost:${port}`);
});

tokenService.start().catch((error: unknown) => {
  console.error('Backend iniciado, mas o token do Spotify não foi carregado:', error);
});
