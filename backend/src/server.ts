import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { libraryRouter } from './modules/library/library.routes';
import { audiusRouter } from './modules/audius/audius.routes';

const app = express();
const port = env.PORT;
const frontendUrl = env.FRONTEND_URL;
const allowedOrigins = Array.from(
  new Set([frontendUrl, 'http://localhost:8100', 'http://127.0.0.1:8100'])
);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'melodix-backend' });
});

app.use('/library', libraryRouter);
app.use('/audius', audiusRouter);
app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`Melodix backend ouvindo em http://localhost:${port}`);
});
