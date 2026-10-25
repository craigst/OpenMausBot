// A Vaultwarden (Bitwarden-compatible) client behind the same seam as the 1Password SDK client.
//
// Why a client and not a provider: OnePasswordLogins already owns everything that matters — the
// vault→bots grants, refresh/TTL, status, candidates(pageHost, botId), sitesFor(botId) and the
// scrub of secret values. Its constructor takes `connect: (token) => OnePasswordClient`, so a
// second implementation of those THREE methods inherits all of that, unchanged and already tested.
// Do not add a parallel provider class or a second fill path.
//
// The password is never decrypted here: `bw` does the KDF and AES work. This process only ever
// receives the plaintext at the moment OnePasswordLogins already needs it to fill a page.
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import type { OnePasswordClient, OnePasswordItemFields } from "./onepassword.ts";

/** Runs one `bw` invocation and returns stdout. Injected so the client is testable without a vault. */
export type BwRunner = (args: string[], input?: string) => Promise<string>;

export interface VaultwardenOptions {
  /** `bw` on PATH, or an absolute path (the companion plugin bundles one at node_modules/.bin/bw). */
  binary?: string;
  /** The organisation whose collections are exposed. Personal items are never shown to agents. */
  organizationId?: string;
  timeoutMs?: number;
}

/** `bw` exits non-zero for a locked or refused session; surface its own words, never the password. */
export function bwFailure(stderr: string, code: number | null, binary: string): Error {
  const detail = stderr.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? "";
  if (/not logged in|invalid master password|vault is locked|session key/iu.test(detail)) {
    return new Error("Vaultwarden refused the credentials: unlock again and connect with a fresh session key.");
  }
  if (/ENOENT|not found/iu.test(detail)) {
    return new Error(`The Vaultwarden command "${binary}" is not installed on this server, so nothing was read.`);
  }
  return new Error(`bw ${detail || `exited ${code ?? "without a status"}`}`);
}

export function defaultBwRunner(options: VaultwardenOptions = {}): BwRunner {
  const binary = options.binary || process.env.VAULTWARDEN_BW_BIN || "bw";
  const timeout = options.timeoutMs ?? 60_000;
  return (args, input) =>
    new Promise((resolve, reject) => {
      const child = execFile(binary, args, { timeout, maxBuffer: 32 * 1024 * 1024 }, (error: Error | null, stdout: string, stderr: string) => {
        if (error) return reject(bwFailure(String(stderr ?? ""), (error as { code?: number }).code ?? null, binary));
        resolve(String(stdout ?? ""));
      });
      if (input !== undefined) child.stdin?.end(input);
    });
}

interface BwItem {
  id?: string;
  name?: string;
  type?: number;
  login?: { username?: string; password?: string; totp?: string; uris?: Array<{ uri?: string }> };
}

interface BwCollection { id?: string; name?: string; organizationId?: string }

const LOGIN_TYPE = 1;

function urlsOf(item: BwItem): string[] {
  return (item.login?.uris ?? []).map((entry) => entry.uri).filter((uri): uri is string => Boolean(uri));
}

/** Reads KEY=VALUE lines into process.env without overriding anything already set.
 *
 *  The build only puts `bw` on PATH; the credentials live in a 0600 file on the data volume
 *  (`/data/.openmausbot/vaultwarden.env`), never in the image and never in config.json. `bw` reads
 *  BW_* from its environment, so the file has to be folded in before the first call.
 *  A missing file is not an error: it means the provider was enabled without credentials, and `bw`
 *  then says so in its own words.
 */
export function loadVaultwardenEnv(file = process.env.OMB_VAULTWARDEN_ENV || "/data/.openmausbot/vaultwarden.env"): number {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return 0;
  }
  let applied = 0;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const at = trimmed.indexOf("=");
    if (at < 1) continue;
    const key = trimmed.slice(0, at).trim();
    const value = trimmed.slice(at + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
    process.env[key] = value;
    applied += 1;
  }
  return applied;
}

export function vaultwardenClient(run: BwRunner, session: string, options: VaultwardenOptions = {}): OnePasswordClient {
  const sessionArgs = ["--session", session];

  const list = async (args: string[]): Promise<unknown> => {
    const raw = await run([...args, ...sessionArgs]);
    try {
      return JSON.parse(raw || "[]");
    } catch {
      throw new Error("Vaultwarden returned something that is not JSON; nothing was imported.");
    }
  };

  return {
    async vaults() {
      const collections = (await list(["list", "org-collections"])) as BwCollection[];
      const org = options.organizationId;
      return collections
        .filter((collection) => Boolean(collection.id) && (!org || collection.organizationId === org))
        .map((collection) => ({ id: collection.id!, title: collection.name || "Collection" }));
    },

    async loginItems(vaultId) {
      const items = (await list(["list", "items", "--organizationid", options.organizationId ?? "", "--collectionid", vaultId])) as BwItem[];
      return items
        .filter((item) => item.type === LOGIN_TYPE && Boolean(item.id))
        // An item with no URI has no site for a fill to match, so it would never be used.
        .filter((item) => urlsOf(item).length > 0)
        .map((item) => ({ id: item.id!, title: item.name || "Login", urls: urlsOf(item) }));
    },

    async fields(_vaultId, itemIds) {
      const found = new Map<string, OnePasswordItemFields>();
      for (const id of itemIds) {
        // One call per item: `bw get` has no batch form. loginItems() already trimmed the set to
        // real logins with a URI, so this stays small.
        const item = JSON.parse(await run(["get", "item", id, ...sessionArgs]) || "{}") as BwItem;
        found.set(id, {
          username: item.login?.username ?? "",
          password: item.login?.password ?? "",
          totp: item.login?.totp ?? null,
        });
      }
      return found;
    },
  };
}
