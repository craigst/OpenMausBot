import { describe, expect, it } from "vitest";

import { bwFailure, vaultwardenClient, type BwRunner } from "./vaultwarden-client.ts";

/** A fake `bw` that answers from a fixture map, so the client is tested without a vault. */
function runner(answers: Record<string, string>): BwRunner & { calls: string[][] } {
  const calls: string[][] = [];
  const run: BwRunner = async (args) => {
    calls.push(args);
    const key = args.slice(0, 2).join(" ");
    if (!(key in answers)) throw new Error(`unexpected bw call: ${args.join(" ")}`);
    return answers[key];
  };
  return Object.assign(run, { calls });
}

const COLLECTIONS = JSON.stringify([
  { id: "c1", name: "Media", organizationId: "org1" },
  { id: "c2", name: "Secret", organizationId: "org1" },
]);

// The vault that produced the bug this guards: `bw list items --collectionid` returns EVERY item in
// the organisation, so the client has to filter on each item's own collectionIds.
const ITEMS = JSON.stringify([
  { id: "i1", name: "Sonarr", type: 1, collectionIds: ["c1"], login: { username: "craig", password: "p", uris: [{ uri: "https://sonarr.lan" }] } },
  { id: "i2", name: "Bank", type: 1, collectionIds: ["c2"], login: { username: "craig", password: "p", uris: [{ uri: "https://bank.example" }] } },
  { id: "i3", name: "No URI", type: 1, collectionIds: ["c1"], login: { username: "craig", password: "p", uris: [] } },
  { id: "i4", name: "API key", type: 2, collectionIds: ["c1"], login: {} },
]);
const SESSION = { session: "SESS", organizationId: "org1" };

describe("vaultwardenClient", () => {
  it("lists only the configured organisation's collections", async () => {
    const run = runner({ "list org-collections": COLLECTIONS });
    const client = vaultwardenClient(run, "pw", SESSION);
    expect(await client.vaults()).toEqual([
      { id: "c1", title: "Media" },
      { id: "c2", title: "Secret" },
    ]);
    expect(run.calls[0]).toContain("--organizationid");
    expect(run.calls[0]).toContain("org1");
  });

  it("refuses to list vaults without an organisation id", async () => {
    const client = vaultwardenClient(runner({}), "pw", { session: "SESS" });
    await expect(client.vaults()).rejects.toThrow(/VAULTWARDEN_ORGANIZATION_ID is not set/u);
  });

  it("returns only the items in the requested collection", async () => {
    const run = runner({ "list items": ITEMS });
    const client = vaultwardenClient(run, "pw", SESSION);
    const media = await client.loginItems("c1");
    const secret = await client.loginItems("c2");
    // i2 lives in c2 and must never appear for c1 — this is the per-vault grant.
    expect(media.map((item) => item.id)).toEqual(["i1"]);
    expect(secret.map((item) => item.id)).toEqual(["i2"]);
  });

  it("drops a login with no URI and a non-login item", async () => {
    const client = vaultwardenClient(runner({ "list items": ITEMS }), "pw", SESSION);
    const items = await client.loginItems("c1");
    expect(items.map((item) => item.id)).not.toContain("i3");
    expect(items.map((item) => item.id)).not.toContain("i4");
  });

  it("reads username, password and a missing totp as null", async () => {
    const run = runner({ "get item": JSON.stringify({ id: "i1", type: 1, login: { username: "craig", password: "secret" } }) });
    const client = vaultwardenClient(run, "pw", SESSION);
    const fields = await client.fields("c1", ["i1"]);
    expect(fields.get("i1")).toEqual({ username: "craig", password: "secret", totp: null });
  });

  it("passes the session to every call", async () => {
    const run = runner({ "list items": ITEMS, "get item": "{}" });
    const client = vaultwardenClient(run, "pw", SESSION);
    await client.loginItems("c1");
    await client.fields("c1", ["i1"]);
    for (const args of run.calls) expect(args).toContain("SESS");
  });

  it("points bw at the vault, logs in and unlocks before the first read", async () => {
    const run = runner({
      "config server": "",
      "login --apikey": "already logged in",
      "unlock pw": "SESSION-FROM-UNLOCK",
      "list org-collections": COLLECTIONS,
    });
    const client = vaultwardenClient(run, "pw", { organizationId: "org1", serverUrl: "https://bw.example" });
    await client.vaults();
    expect(run.calls[0]).toEqual(["config", "server", "https://bw.example"]);
    expect(run.calls[1]).toEqual(["login", "--apikey"]);
    expect(run.calls[2]).toEqual(["unlock", "pw", "--raw"]);
    expect(run.calls[3]).toContain("SESSION-FROM-UNLOCK");
  });

  it("survives a vault that is already configured and logged in", async () => {
    const run: BwRunner = async (args) => {
      if (args[0] === "config") throw new Error("Logout required before server config update.");
      if (args[0] === "login") throw new Error("You are already logged in.");
      if (args[0] === "unlock") return "SESSION\n";
      return COLLECTIONS;
    };
    const client = vaultwardenClient(run, "pw", { organizationId: "org1", serverUrl: "https://bw.example" });
    expect(await client.vaults()).toHaveLength(2);
  });

  it("refuses a vault that is locked, in words about credentials rather than internals", () => {
    expect(bwFailure("Vault is locked.", 1, "bw").message).toMatch(/unlock again/u);
  });

  it("says so plainly when bw is not installed", () => {
    expect(bwFailure("spawn bw ENOENT", 127, "bw").message).toMatch(/not installed/u);
  });
});
