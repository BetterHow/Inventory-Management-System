import { SignJWT, jwtVerify } from "jose";

// Shared by middleware (edge) and server code, so no database access here.
export const SESSION_COOKIE = "ims_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

export type SessionPayload = { uid: number; role: "ADMIN" | "STAFF"; name: string };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET must be set (16+ characters)");
  return new TextEncoder().encode(secret);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT(p)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE;
