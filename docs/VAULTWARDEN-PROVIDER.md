# A Vaultwarden provider for OpenMausBot

**Status: not implemented. This is the specification and the interface it must satisfy.**

## Why this shape

OMB already has a provider seam. `BotLogins` merges two sources and the fill path
(`login-fill.ts`) types a credential into a page without the model ever seeing it:

```
BotLogins = LoginStore (encrypted local, per-bot) + OnePasswordLogins
                              ↓
                    login-fill.ts → the page
```

`OnePasswordLogins` (`server/onepassword.ts`) satisfies one interface:

```ts
export interface OnePasswordClient {
  vaults(): Promise<Array<{ id: string; title: string }>>;
  loginItems(vaultId: string): Promise<Array<{ id: string; title: string; urls: string[] }>>;
  fields(vaultId: string, itemIds: string[]): Promise<Map<string, OnePasswordItemFields>>;
}
```

A Vaultwarden provider is a second implementation of those three methods plus the same
per-vault bot grants (`LoginStore.setOnePasswordGrant`). **Do not** add a parallel fill path or a
new tool — the whole point is that the existing one already keeps secrets out of the transcript.

## Design decision to make first: where the master password lives

| option | consequence |
|---|---|
| **A. `bw` CLI on the OMB host** | Simple, no crypto to reimplement — the CLI already does PBKDF2/Argon2 + AES-CBC. Needs `bw` in the image and a vault config on **us-vps** (master password leaves cleo). |
| **B. Bitwarden HTTP API in-process** | No CLI, but we reimplement decrypt (KDF, symmetric key unwrap, per-cipher HMAC verification). Much easier to get subtly wrong. |
| **C. Bridge only (already shipped)** | `vaultwarden-bridge/push-logins.js` pushes web logins into `LoginStore` daily. No provider, no UI browse, and the vault stays on cleo. |

Recommendation: **A**, and treat the vault config as a per-deployment secret (`/data/.openmausbot/vaultwarden.env`),
never a soul or a memory. If the estate is not willing to put the master password on us-vps, stop here —
the bridge already covers the use case.

## What the provider must do

1. **Auth** — `BW_CLIENTID` + `BW_CLIENTSECRET` (personal API key) then unlock with `BW_PASSWORD`,
   or a single `BW_SESSION` token. Fail closed with a readable message; never log the password.
2. **`vaults()`** — organisations/collections the account can read, mapped to `{id, title}`.
3. **`loginItems(vaultId)`** — only items whose type is *login* and which carry at least one URI.
   Skip secure notes and API-key items: OMB fills forms, it does not hand out keys.
4. **`fields(vaultId, ids)`** — `{username, password, totp}` per item. TOTP only if present.
5. **Grants** — reuse `LoginStore.onePasswordGrants` keyed by the Vaultwarden collection id so one
   code path scopes both providers. A collection absent from the map is `"all"` — keep that default
   only if it matches the operator's intent; otherwise invert it to `[]` and require explicit grants.
6. **Refresh** — mirror `OnePasswordLogins.refresh()`: a TTL, one in-flight refresh, a `status()`
   that reports `connected` and `error` without leaking anything.

## Traps already paid for by the bridge

- `exactHost` — two hosts under one registrable domain (`messenger.evoonline.co.uk`,
  `nc.evoonline.co.uk`) collapse to site `evoonline.co.uk` and the second password overwrites the
  first unless `exactHost` is true. Whatever this provider feeds must carry the same distinction.
- The 128-tool MCP cap is unrelated to logins, but both bite silently. Do not confuse "the bot has
  no tools" with "the login did not store" — check `/api/logins` first.

## Test plan

- Unit: a fake `bw` (or a recorded `/sync` fixture) for the three methods, including
  an item with no URI, one with no username, and one with TOTP absent.
- Integration: `BotLogins.sitesFor(botId)` lists the vault's logins only for permitted bots.
- Fill: a stub page asserts the password is typed and **never** returned to the caller.
- Regression: `LoginStore.create` dedupe still applies when the same login arrives from both
  the vault and a sign-in card.

## Rollout

1. Provider behind a config flag, default off.
2. Enable for one bot and one collection.
3. Compare `/api/logins` and `sitesFor()` against the bridge's output before retiring the bridge.
