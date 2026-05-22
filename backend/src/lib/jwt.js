import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

if (process.env.NODE_ENV !== "production" && (!process.env.JWT_SECRET || JWT_SECRET === "dev-secret")) {
  // eslint-disable-next-line no-console
  console.warn("[security] Using default JWT_SECRET — set a long random JWT_SECRET before production.");
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
