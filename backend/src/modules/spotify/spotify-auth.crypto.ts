import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'crypto';
import { env } from '../../config/env';
import { HttpError } from '../../utils/http-error';

interface OAuthStatePayload {
  sub: string;
  exp: number;
  nonce: string;
}

const tokenEncryptionKey = createHash('sha256')
  .update(env.SPOTIFY_TOKEN_ENCRYPTION_KEY)
  .digest();

const sign = (value: string): string =>
  createHmac('sha256', env.SPOTIFY_OAUTH_STATE_SECRET)
    .update(value)
    .digest('base64url');

export const createOAuthState = (userId: string): string => {
  const payload: OAuthStatePayload = {
    sub: userId,
    exp: Date.now() + 10 * 60 * 1000,
    nonce: randomBytes(16).toString('base64url')
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  return `${encodedPayload}.${sign(encodedPayload)}`;
};

export const readOAuthState = (state: string): OAuthStatePayload => {
  const [encodedPayload, signature] = state.split('.');

  if (!encodedPayload || !signature) {
    throw new HttpError('State OAuth invalido.', 400);
  }

  const expectedSignature = sign(encodedPayload);
  const providedSignature = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    providedSignature.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(providedSignature, expectedSignatureBuffer)
  ) {
    throw new HttpError('State OAuth invalido.', 400);
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString('utf8')
  ) as OAuthStatePayload;

  if (!payload.sub || !payload.exp || payload.exp < Date.now()) {
    throw new HttpError('State OAuth expirado.', 400);
  }

  return payload;
};

export const encryptRefreshToken = (refreshToken: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenEncryptionKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(refreshToken, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
};

export const decryptRefreshToken = (encryptedRefreshToken: string): string => {
  const [ivValue, authTagValue, encryptedValue] = encryptedRefreshToken.split('.');

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new HttpError('Credencial Spotify invalida.', 500);
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    tokenEncryptionKey,
    Buffer.from(ivValue, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
};
