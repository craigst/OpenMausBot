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
  { id: "c1", name: "Personal", organizationId: "org1" },
  { id: "c2", name: "Other org", organizationId: "org2" },
]);

const ITEMS = JSON.stringify([
  { id: "i1", name: "Sonarr", type: 1, login: { username: "craig", password: "p", uris: [{ uri: "https://sonarr.lan" }] } },
  { id: "i2", name: "No URI", type: 1, login: { username: "craig", password: "p", uris: [] } },
  { id: "i3", name: "API key", type: 2, login: {} },
]);

describe("vaultwardenClient", () => {
  it("lists only the configured organisation's collections", async () => {
    const run = runner({ "list org-collections": COLLECTIONS });
    const client = vaultwardenClient(run, "session", { organizationId: "org1" });
    expect(await client.vaults()).toEqual([{ id: "c1", title: "Personal" }]);
  });

  it("offers only real logins that carry a URI", async () => {
    const run = runner({ "list items": ITEMS });
    const client = vaultwardenClient(run, "session", { organizationId: "org1" });
    const items = await client.loginItems("c1");
    expect(items.map((item) => item.id)).toEqual(["i1"]);
    expect(items[0]!.urls).toEqual(["https://sonarr.lan"]);
  });

  it("reads username, password and a missing totp as null", async () => {
    const run = runner({ "get item": JSON.stringify({ id: "i1", type: 1, login: { username: "craig", password: "secret" } }) });
    const client = vaultwardenClient(run, "session");
    const fields = await client.fields("c1", ["i1"]);
    expect(fields.get("i1")).toEqual({ username: "craig", password: "secret", totp: null });
  });

  it("passes the session to every call and never puts it in the item path", async () => {
    const run = runner({ "list items": ITEMS, "get item": "{}" });
    const client = vaultwardenClient(run, "SESS");
    await client.loginItems("c1");
    await client.fields("c1", ["i1"]);
    for (const args of run.calls) expect(args).toContain("SESS");
  });

  it("refuses a vault that is locked, in words about credentials rather than internals", () => {
    const error = bwFailure("Vault is locked.", 1, "bw");
    expect(error.message).toMatch(/unlock again/);
  });

  it("says so plainly when bw is not installed", () => {
    expect(bwFailure("spawn bw ENOENT", 127, "bw").message).toMatch(/not installed/);
  });
});
