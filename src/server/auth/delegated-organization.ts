import { AuthRepository } from "@/server/auth/repositories/AuthRepository";

const SHARED_ORGANIZATION = {
  id: "delegated-workspace",
  name: "OpenSEO workspace",
  slug: "delegated-openseo-workspace",
} as const;

export async function ensureSharedDelegatedOrganization() {
  // Before shared workspaces, delegated auth created one organization per
  // external user. Adopt the oldest one so an existing self-host keeps its
  // projects when this deployment upgrades. On a fresh database every caller
  // races safely toward the same fixed organization id.
  const existingOrganizationId =
    await AuthRepository.findOldestDelegatedOrganizationId();
  if (existingOrganizationId) {
    return existingOrganizationId;
  }

  await AuthRepository.upsertDelegatedOrganization(SHARED_ORGANIZATION);

  return SHARED_ORGANIZATION.id;
}
