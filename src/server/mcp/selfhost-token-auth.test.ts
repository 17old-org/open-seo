import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnv, findFirstMock, resolveSharedWorkspaceContextMock } = vi.hoisted(
  () => ({
    mockEnv: {} as Record<string, string | undefined>,
    findFirstMock: vi.fn(),
    resolveSharedWorkspaceContextMock: vi.fn(),
  }),
);

vi.mock("cloudflare:workers", () => ({ env: mockEnv }));

vi.mock("@/db", () => ({
  db: { query: { user: { findFirst: findFirstMock } } },
}));

vi.mock("@/db/schema", () => ({ user: { email: "user.email" } }));

vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => "eq") }));

vi.mock("@/middleware/ensure-user/delegated", () => ({
  resolveSharedWorkspaceContext: resolveSharedWorkspaceContextMock,
}));

import {
  readPresentedSelfHostMcpToken,
  resolveSelfHostMcpTokenContext,
  SELFHOST_MCP_TOKEN_PREFIX,
} from "./selfhost-token-auth";

const VALID_TOKEN = `${SELFHOST_MCP_TOKEN_PREFIX}${"a".repeat(48)}`;

function headers(init: Record<string, string>) {
  return new Headers(init);
}

beforeEach(() => {
  for (const key of Object.keys(mockEnv)) delete mockEnv[key];
  findFirstMock.mockReset();
  resolveSharedWorkspaceContextMock.mockReset();
});

describe("readPresentedSelfHostMcpToken", () => {
  it("reads both header shapes", () => {
    expect(
      readPresentedSelfHostMcpToken(headers({ "x-api-key": VALID_TOKEN })),
    ).toBe(VALID_TOKEN);
    expect(
      readPresentedSelfHostMcpToken(
        headers({ Authorization: `Bearer ${VALID_TOKEN}` }),
      ),
    ).toBe(VALID_TOKEN);
  });

  it("ignores credentials without the prefix", () => {
    // A Cloudflare Access OAuth token arrives on the same header; leaving it
    // alone is what keeps the Access path working.
    expect(
      readPresentedSelfHostMcpToken(
        headers({ Authorization: "Bearer cf-access-token" }),
      ),
    ).toBeNull();
    expect(readPresentedSelfHostMcpToken(headers({}))).toBeNull();
  });
});

describe("resolveSelfHostMcpTokenContext", () => {
  it("falls through when the request carries no secret of ours", async () => {
    mockEnv.SELFHOST_MCP_TOKEN = VALID_TOKEN;
    await expect(resolveSelfHostMcpTokenContext(headers({}))).resolves.toBeNull();
  });

  it("falls through when the feature is not configured", async () => {
    await expect(
      resolveSelfHostMcpTokenContext(headers({ "x-api-key": VALID_TOKEN })),
    ).resolves.toBeNull();
  });

  it("falls through on a wrong secret rather than rejecting the request", async () => {
    mockEnv.SELFHOST_MCP_TOKEN = VALID_TOKEN;
    await expect(
      resolveSelfHostMcpTokenContext(
        headers({ "x-api-key": `${SELFHOST_MCP_TOKEN_PREFIX}${"b".repeat(48)}` }),
      ),
    ).resolves.toBeNull();
  });

  it("rejects a configured secret that is too short to be one", async () => {
    mockEnv.SELFHOST_MCP_TOKEN = `${SELFHOST_MCP_TOKEN_PREFIX}short`;
    await expect(
      resolveSelfHostMcpTokenContext(
        headers({ "x-api-key": `${SELFHOST_MCP_TOKEN_PREFIX}short` }),
      ),
    ).rejects.toThrow(/at least/);
  });

  it("requires the identity email", async () => {
    mockEnv.SELFHOST_MCP_TOKEN = VALID_TOKEN;
    await expect(
      resolveSelfHostMcpTokenContext(headers({ "x-api-key": VALID_TOKEN })),
    ).rejects.toThrow(/SELFHOST_MCP_USER_EMAIL/);
  });

  it("requires the named user to already exist", async () => {
    mockEnv.SELFHOST_MCP_TOKEN = VALID_TOKEN;
    mockEnv.SELFHOST_MCP_USER_EMAIL = "someone@example.com";
    findFirstMock.mockResolvedValue(undefined);
    await expect(
      resolveSelfHostMcpTokenContext(headers({ "x-api-key": VALID_TOKEN })),
    ).rejects.toThrow(/No user exists/);
  });

  it("resolves the existing user's shared-workspace context", async () => {
    mockEnv.SELFHOST_MCP_TOKEN = VALID_TOKEN;
    mockEnv.SELFHOST_MCP_USER_EMAIL = "someone@example.com";
    findFirstMock.mockResolvedValue({
      id: "cf-access-sub",
      email: "someone@example.com",
    });
    resolveSharedWorkspaceContextMock.mockResolvedValue({
      userId: "cf-access-sub",
      userEmail: "someone@example.com",
      emailVerified: true,
      organizationId: "shared-workspace",
      role: "owner",
    });

    await expect(
      resolveSelfHostMcpTokenContext(
        headers({ Authorization: `Bearer ${VALID_TOKEN}` }),
      ),
    ).resolves.toMatchObject({
      userId: "cf-access-sub",
      organizationId: "shared-workspace",
    });
    // The Search Console grant hangs off the user id, so reusing the existing
    // row (not a synthetic one) is the whole point.
    expect(resolveSharedWorkspaceContextMock).toHaveBeenCalledWith(
      "cf-access-sub",
      "someone@example.com",
    );
  });
});
