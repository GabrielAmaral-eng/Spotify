import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { libraryRouter } from './modules/library/library.routes';
import { audiusRouter } from './modules/audius/audius.routes';

const app = express();
const port = env.PORT;
const frontendUrl = env.FRONTEND_URL;
const allowedOrigins = new Set([
  frontendUrl,
  'http://localhost:8100',
  'http://127.0.0.1:8100',
  'capacitor://localhost',   // Capacitor iOS WebView
  'http://localhost',         // Capacitor Android WebView
]);
const localNetworkOrigin =
  /^http:\/\/(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):8100$/;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || localNetworkOrigin.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origem nao permitida pelo CORS: ${origin}`));
    },
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
