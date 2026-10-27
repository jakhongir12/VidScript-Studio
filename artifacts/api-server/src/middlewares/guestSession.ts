import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const COOKIE_NAME = "vidscript_session";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const guestSession: RequestHandler = (req, res, next) => {
  const savedOwner = req.signedCookies?.[COOKIE_NAME];
  if (typeof savedOwner === "string" && UUID_PATTERN.test(savedOwner)) {
    res.locals.guestOwnerId = savedOwner;
    next();
    return;
  }

  const ownerId = randomUUID();
  res.cookie(COOKIE_NAME, ownerId, {
    signed: true,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
  res.locals.guestOwnerId = ownerId;
  next();
};
