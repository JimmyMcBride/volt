import { readFile } from "node:fs/promises";
import { contentHash } from "./stable.mjs";
import { validateAuthorizationManifest } from "./validation.mjs";

export class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorizationError";
  }
}

function validateEstimatedSpendUsd(value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new AuthorizationError("estimated spend must be a finite non-negative number");
  }
  return value;
}

export function parseEstimatedSpendUsd(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AuthorizationError("--estimated-spend is required for live phases");
  }
  return validateEstimatedSpendUsd(Number(value));
}

export function assertAuthorized({
  manifest,
  phase,
  expectedHashes,
  estimatedSpendUsd
}) {
  validateAuthorizationManifest(manifest);
  validateEstimatedSpendUsd(estimatedSpendUsd);
  if (manifest.phase !== phase) {
    throw new AuthorizationError(`authorization phase ${manifest.phase} does not permit ${phase}`);
  }
  if (manifest.approved !== true) throw new AuthorizationError(`${phase} authorization is not owner-approved`);
  for (const [key, expected] of Object.entries(expectedHashes)) {
    if (manifest[key] !== expected) {
      throw new AuthorizationError(`${phase} authorization hash mismatch for ${key}`);
    }
  }
  if (estimatedSpendUsd > manifest.maximumSpendUsd) {
    throw new AuthorizationError(
      `estimated spend $${estimatedSpendUsd.toFixed(2)} exceeds approved ceiling $${manifest.maximumSpendUsd.toFixed(2)}`
    );
  }
  return {
    phase,
    approvalId: manifest.approvalId,
    authorizationHash: contentHash(manifest),
    maximumSpendUsd: manifest.maximumSpendUsd
  };
}

export async function loadAuthorization(path) {
  if (path === undefined) throw new AuthorizationError("an authorization manifest path is required");
  return validateAuthorizationManifest(JSON.parse(await readFile(path, "utf8")));
}

export function refuseProviderBoundary(mode) {
  if (mode === "offline") return;
  throw new AuthorizationError(
    `${mode} provider execution is not part of the approved offline implementation; present and approve the frozen authorization manifest first`
  );
}
