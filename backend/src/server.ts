import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { errorMiddleware } from './middlewares/error.middleware';
import { playlistRouter } from './routes/playlist.routes';
import { sessionRouter } from './routes/session.routes';
import { spotifyRouter } from './routes/spotify.routes';
import { userRouter } from './routes/user.routes';
import { tokenService } from './services/token.service';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3000);
const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:8100';

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

app.use('/session', sessionRouter);
app.use('/spotify', spotifyRouter);
app.use('/playlists', playlistRouter);
app.use('/', userRouter);
app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`Melodix backend ouvindo em http://localhost:${port}`);
});

tokenService.start().catch((error: unknown) => {
  console.error('Backend iniciado, mas o token do Spotify não foi carregado:', error);
});
