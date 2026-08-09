import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOldestDelegatedOrganizationId: vi.fn(),
  upsertDelegatedOrganization: vi.fn(),
}));

vi.mock("@/server/auth/repositories/AuthRepository", () => ({
  AuthRepository: mocks,
}));

describe("shared delegated organization", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("adopts the oldest delegated workspace on an existing self-host", async () => {
    mocks.findOldestDelegatedOrganizationId.mockResolvedValue(
      "delegated-existing-owner",
    );
    const { ensureSharedDelegatedOrganization } =
      await import("./delegated-organization");

    await expect(ensureSharedDelegatedOrganization()).resolves.toBe(
      "delegated-existing-owner",
    );
    expect(mocks.upsertDelegatedOrganization).not.toHaveBeenCalled();
  });

  it("creates one fixed workspace on a fresh self-host", async () => {
    mocks.findOldestDelegatedOrganizationId.mockResolvedValue(null);
    const { ensureSharedDelegatedOrganization } =
      await import("./delegated-organization");

    await expect(ensureSharedDelegatedOrganization()).resolves.toBe(
      "delegated-workspace",
    );
    expect(mocks.upsertDelegatedOrganization).toHaveBeenCalledWith({
      id: "delegated-workspace",
      name: "OpenSEO workspace",
      slug: "delegated-openseo-workspace",
    });
  });
});
