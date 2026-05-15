declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      sessionToken?: string;
    }
  }
}

export {};
