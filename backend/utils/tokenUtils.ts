import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

export type AppRole = "admin" | "brand" | "influencer";

type TokenPayload = {
  id: string;
  role: AppRole;
};

type JwtPayload = TokenPayload & {
  iat?: number;
  exp?: number;
};

const ACCESS_TOKEN_TTL = (process.env.ACCESS_TOKEN_TTL || "15m") as SignOptions["expiresIn"];
const REFRESH_TOKEN_TTL = (process.env.REFRESH_TOKEN_TTL || "30d") as SignOptions["expiresIn"];

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET as string), {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET as string)) as JwtPayload;
}

export function getRefreshCookieName(role: AppRole): string {
  return `${role}_refresh_token`;
}

export function setRefreshTokenCookie(res: any, role: AppRole, refreshToken: string): void {
  res.cookie(getRefreshCookieName(role), refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearRefreshTokenCookie(res: any, role: AppRole): void {
  res.clearCookie(getRefreshCookieName(role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
