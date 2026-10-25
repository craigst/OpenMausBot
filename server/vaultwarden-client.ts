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
  /** The organisation whose collections are exposed. REQUIRED: `bw list org-collections` refuses without it. */
  organizationId?: string;
  /** The Vaultwarden base URL. `bw` defaults to bitwarden.com, so this must be set for a self-hosted vault. */
  serverUrl?: string;
  /** Skip the login/unlock bootstrap and use this session key (used by the tests). */
  session?: string;
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
  collectionIds?: string[];
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

export function vaultwardenClient(run: BwRunner, token: string, options: VaultwardenOptions = {}): OnePasswordClient {
  const orgId = options.organizationId || process.env.VAULTWARDEN_ORGANIZATION_ID || "";
  const serverUrl = options.serverUrl || process.env.VAULTWARDEN_URL || "";
  let pending: Promise<string> | null = null;

  /** One bootstrap for the whole client: point bw at Vaultwarden, log in, unlock.
   *
   *  `bw` defaults to bitwarden.com, so without `config server` a self-hosted vault answers
   *  "client_id or client_secret is incorrect" — which looks like bad credentials and is not.
   *  `bw login --apikey` fails with "already logged in", which is success for our purposes.
   */
  const session = () => {
    if (options.session) return Promise.resolve(options.session);
    if (process.env.BW_SESSION) return Promise.resolve(process.env.BW_SESSION);
    if (!pending) {
      pending = (async () => {
        // A persisted HOME stays logged in, and `bw` then refuses to change the server
        // ("Logout required before server config update"). That means it is already configured,
        // which is what we wanted, so login/unlock below are the real gate.
        if (serverUrl) await run(["config", "server", serverUrl]).catch(() => undefined);
        await run(["login", "--apikey"]).catch(() => undefined);
        const unlocked = (await run(["unlock", token, "--raw"])).trim();
        if (!unlocked) {
          throw new Error("Vaultwarden did not return a session key; the master password was not accepted.");
        }
        return unlocked;
      })();
    }
    return pending;
  };

  const list = async (args: string[]): Promise<unknown> => {
    const key = await session();
    const raw = await run([...args, "--session", key]);
    try {
      return JSON.parse(raw || "[]");
    } catch {
      throw new Error("Vaultwarden returned something that is not JSON; nothing was imported.");
    }
  };

  /** Every item in the organisation, fetched ONCE.
   *
   *  `bw list items` already returns decrypted logins, so `fields()` can be answered from here.
   *  The first version ran `bw get` per item: with 150 items that was over a minute of subprocesses,
   *  and the connect request simply hung. One listing serves both methods.
   */
  let itemsOnce: Promise<BwItem[]> | null = null;
  const allItems = () => {
    if (!itemsOnce) {
      itemsOnce = list(["list", "items", "--organizationid", orgId]).then((raw) => (Array.isArray(raw) ? (raw as BwItem[]) : []));
    }
    return itemsOnce;
  };

  return {
    async vaults() {
      if (!orgId) {
        throw new Error(
          "VAULTWARDEN_ORGANIZATION_ID is not set: `bw list org-collections` requires an organisation id, so no vault can be listed.",
        );
      }
      const collections = (await list(["list", "org-collections", "--organizationid", orgId])) as BwCollection[];
      const org = orgId;
      return collections
        .filter((collection) => Boolean(collection.id) && (!org || collection.organizationId === org))
        .map((collection) => ({ id: collection.id!, title: collection.name || "Collection" }));
    },

    async loginItems(vaultId) {
      // `bw list items --collectionid` does NOT filter: it returns every item in the organisation.
      // Measured on a real vault — all nine collections came back with the same 63 logins — so the
      // filter has to run here, on each item's own collectionIds. Without it a bot granted "media"
      // would be offered the "security-agent" logins too, which is the whole point of the grants.
      const items = await allItems();
      return items
        .filter((item) => (item.collectionIds ?? []).includes(vaultId))
        .filter((item) => item.type === LOGIN_TYPE && Boolean(item.id))
        // An item with no URI has no site for a fill to match, so it would never be used.
        .filter((item) => urlsOf(item).length > 0)
        .map((item) => ({ id: item.id!, title: item.name || "Login", urls: urlsOf(item) }));
    },

    async fields(_vaultId, itemIds) {
      const wanted = new Set(itemIds);
      const found = new Map<string, OnePasswordItemFields>();
      for (const item of await allItems()) {
        if (!item.id || !wanted.has(item.id)) continue;
        found.set(item.id, {
          username: item.login?.username ?? "",
          password: item.login?.password ?? "",
          totp: item.login?.totp ?? null,
        });
      }
      return found;
    },
  };
}
