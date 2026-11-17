import process from "node:process";
import { createRemoteJWKSet, jwtVerify } from "jose";

const firebaseSigningKeys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

function authError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function verifyFirebaseIdToken(
  authorization,
  projectId = process.env.FIREBASE_PROJECT_ID,
) {
  const match = /^Bearer\s+(.+)$/i.exec(authorization || "");
  if (!match) {
    throw authError(401, "Sign in to continue.");
  }
  if (!projectId) {
    throw authError(503, "Firebase server authentication is not configured.");
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(match[1], firebaseSigningKeys, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    }));
  } catch {
    throw authError(401, "Your session is invalid or expired. Sign in again.");
  }

  if (
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.email_verified !== true
  ) {
    throw authError(403, "Verify your email before using this service.");
  }

  return { uid: payload.sub, email: payload.email || "" };
}
