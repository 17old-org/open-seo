import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { resolveSharedWorkspaceContext } from "@/middleware/ensure-user/delegated";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { AppError } from "@/server/lib/errors";

// Fork-local addition (not upstream). Cloudflare Access fronts this
// deployment, and the MCP credential it issues is an Access OAuth token that
// lives 15 minutes; its refresh token is bound to the Access session, so once
// that session lapses (24h by default) refresh fails with `invalid_grant` and
// every MCP client has to redo the interactive browser flow. A cron job can
// never do that at all.
//
// So /mcp gets a second, non-interactive credential: one long-lived shared
// secret, checked here. The Access application in front of /mcp becomes a
// Service Auth (or bypass) policy rather than an identity gate — this check is
// what authenticates the caller, and it fails closed: a request with no
// matching secret still falls through to Cloudflare Access JWT verification.
//
// Upstream's own API keys (`oseo_`, server/mcp/api-key-auth.ts) can't be used
// here: they are registered only when AUTH_MODE=hosted, and their /mcp path
// routes through getHostedBaseUrl(), which self-host deliberately leaves
// unset.

// Marks a credential as ours. Anything without this prefix — notably a
// Cloudflare Access access token on the same Authorization header — is left
// alone so the Access path keeps working unchanged.
export const SELFHOST_MCP_TOKEN_PREFIX = "osmk_";

// 32 random base64url characters is the shape `openssl rand -base64 24` gives;
// refuse anything shorter so a placeholder can't become the deployment's only
// door.
const MIN_SECRET_LENGTH = SELFHOST_MCP_TOKEN_PREFIX.length + 32;

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

/**
 * The presented secret, or null when the request carries no credential of
 * ours. Both header shapes that MCP clients can be configured with are
 * accepted; the prefix is what discriminates, exactly as it does for upstream
 * API keys.
 */
export function readPresentedSelfHostMcpToken(headers: Headers): string | null {
  const headerKey = headers.get("x-api-key");
  if (headerKey?.startsWith(SELFHOST_MCP_TOKEN_PREFIX)) return headerKey;

  const bearer = headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (bearer?.startsWith(SELFHOST_MCP_TOKEN_PREFIX)) return bearer;

  return null;
}

/**
 * Identity for a request authenticated by the shared secret, or null to let
 * the caller fall through to Cloudflare Access.
 *
 * The identity is a real row: SELFHOST_MCP_USER_EMAIL names the user that
 * already signed in through Access, so the MCP session reuses that user's
 * Google Search Console grant (stored per user on `account`) instead of
 * landing on a fresh id with no connections.
 */
export async function resolveSelfHostMcpTokenContext(
  headers: Headers,
): Promise<EnsuredUserContext | null> {
  const presented = readPresentedSelfHostMcpToken(headers);
  if (!presented) return null;

  const configured = env.SELFHOST_MCP_TOKEN?.trim();
  if (!configured) return null;

  // Set-but-malformed is an operator mistake, not a bad caller: shout about it
  // before the comparison so it can never be mistaken for a wrong secret.
  if (
    !configured.startsWith(SELFHOST_MCP_TOKEN_PREFIX) ||
    configured.length < MIN_SECRET_LENGTH
  ) {
    throw new AppError(
      "AUTH_CONFIG_MISSING",
      `SELFHOST_MCP_TOKEN must start with "${SELFHOST_MCP_TOKEN_PREFIX}" and be at least ${MIN_SECRET_LENGTH} characters. Generate one with: printf '${SELFHOST_MCP_TOKEN_PREFIX}%s\\n' "$(openssl rand -hex 24)".`,
    );
  }

  if (!timingSafeEqual(presented, configured)) {
    // Not our secret. Say nothing and let Access decide — a valid Access JWT
    // on the same request is still a legitimate caller.
    console.debug("[mcp-selfhost-token] no match; falling through to Access");
    return null;
  }

  const email = env.SELFHOST_MCP_USER_EMAIL?.trim();
  if (!email) {
    throw new AppError(
      "AUTH_CONFIG_MISSING",
      "SELFHOST_MCP_TOKEN is set but SELFHOST_MCP_USER_EMAIL is not — set it to the Cloudflare Access email whose workspace and Search Console connection the MCP session should use.",
    );
  }

  const existing = await db.query.user.findFirst({
    columns: { id: true, email: true },
    where: eq(user.email, email),
  });

  if (!existing) {
    throw new AppError(
      "AUTH_CONFIG_MISSING",
      `No user exists for SELFHOST_MCP_USER_EMAIL (${email}). Sign in to the app through Cloudflare Access with that address once, then retry.`,
    );
  }

  return resolveSharedWorkspaceContext(existing.id, existing.email);
}
