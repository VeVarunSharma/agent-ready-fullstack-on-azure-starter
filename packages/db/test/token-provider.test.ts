import { describe, expect, it, vi } from "vitest";

import {
  DatabaseAuthenticationError,
  RefreshingTokenProvider,
  createAzureTokenProvider,
  createDefaultAzureCredential,
  type AccessToken,
  type AzureIdentityModule,
  type TokenCredential,
} from "../src/internal/token-provider";

const managedIdentityConfiguration = {
  mode: "azure-managed-identity",
  host: "database.invalid",
  port: 5432,
  database: "app",
  user: "application",
  managedIdentityClientId: "7af253a4-147b-48cf-b158-a5d79810b2a7",
  poolMax: 1,
  probeTimeoutMs: 1_000,
} as const;

const localAzureConfiguration = {
  mode: "local-azure-credential",
  host: "database.invalid",
  port: 5432,
  database: "app",
  user: "developer",
  poolMax: 1,
  probeTimeoutMs: 1_000,
} as const;

describe("RefreshingTokenProvider", () => {
  it("injects the PostgreSQL scope and refreshes near expiry", async () => {
    let now = 1_000_000;
    const getToken = vi
      .fn<TokenCredential["getToken"]>()
      .mockResolvedValueOnce({
        token: "first-token",
        expiresOnTimestamp: now + 300_000,
      })
      .mockResolvedValueOnce({
        token: "second-token",
        expiresOnTimestamp: now + 600_000,
      });
    const provider = new RefreshingTokenProvider(() => Promise.resolve({ getToken }), {
      now: () => now,
      refreshSkewMs: 120_000,
    });

    await expect(provider.getPassword()).resolves.toBe("first-token");
    await expect(provider.getPassword()).resolves.toBe("first-token");
    now += 200_000;
    await expect(provider.getPassword()).resolves.toBe("second-token");

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(getToken).toHaveBeenCalledWith("https://ossrdbms-aad.database.windows.net/.default");
  });

  it("deduplicates concurrent token refreshes", async () => {
    const getToken = vi.fn<TokenCredential["getToken"]>().mockResolvedValue({
      token: "shared-token",
      expiresOnTimestamp: Date.now() + 300_000,
    });
    const provider = new RefreshingTokenProvider(() => Promise.resolve({ getToken }));

    await expect(Promise.all([provider.getPassword(), provider.getPassword()])).resolves.toEqual([
      "shared-token",
      "shared-token",
    ]);
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it("fails closed when Azure returns no usable token", async () => {
    const provider = new RefreshingTokenProvider(() =>
      Promise.resolve({
        getToken: () => Promise.resolve(null),
      }),
    );

    await expect(provider.getPassword()).rejects.toBeInstanceOf(DatabaseAuthenticationError);
  });

  it("retries lazy credential creation after a transient failure", async () => {
    const credentialFactory = vi
      .fn<() => Promise<TokenCredential>>()
      .mockRejectedValueOnce(new Error("credential unavailable"))
      .mockResolvedValueOnce({
        getToken: () =>
          Promise.resolve({
            token: "recovered-token",
            expiresOnTimestamp: Date.now() + 300_000,
          }),
      });
    const provider = new RefreshingTokenProvider(credentialFactory);

    await expect(provider.getPassword()).rejects.toThrow("credential unavailable");
    await expect(provider.getPassword()).resolves.toBe("recovered-token");
    expect(credentialFactory).toHaveBeenCalledTimes(2);
  });

  it("does not create a credential until pg requests a password", async () => {
    const credentialFactory = vi.fn(() =>
      Promise.resolve({
        getToken: () =>
          Promise.resolve({
            token: "token",
            expiresOnTimestamp: Date.now() + 300_000,
          }),
      }),
    );
    const provider = createAzureTokenProvider(localAzureConfiguration, credentialFactory);

    expect(credentialFactory).not.toHaveBeenCalled();
    await provider.getPassword();
    expect(credentialFactory).toHaveBeenCalledOnce();
  });
});

describe("Azure credential selection", () => {
  it("constructs ManagedIdentityCredential explicitly in Azure mode", async () => {
    const managedOptions: { readonly clientId: string }[] = [];
    let defaultCredentialCount = 0;
    const getToken = (): Promise<AccessToken | null> => Promise.resolve(null);
    const identityModule: AzureIdentityModule = {
      ManagedIdentityCredential: class {
        constructor(options: { readonly clientId: string }) {
          managedOptions.push(options);
        }

        getToken = getToken;
      },
      DefaultAzureCredential: class {
        constructor() {
          defaultCredentialCount += 1;
        }

        getToken = getToken;
      },
    };

    await createDefaultAzureCredential(managedIdentityConfiguration, () =>
      Promise.resolve(identityModule),
    );

    expect(managedOptions).toEqual([
      { clientId: managedIdentityConfiguration.managedIdentityClientId },
    ]);
    expect(defaultCredentialCount).toBe(0);
  });

  it("constructs DefaultAzureCredential only for explicit local Azure mode", async () => {
    let managedCredentialCount = 0;
    let defaultCredentialCount = 0;
    const getToken = (): Promise<AccessToken | null> => Promise.resolve(null);
    const identityModule: AzureIdentityModule = {
      ManagedIdentityCredential: class {
        constructor() {
          managedCredentialCount += 1;
        }

        getToken = getToken;
      },
      DefaultAzureCredential: class {
        constructor() {
          defaultCredentialCount += 1;
        }

        getToken = getToken;
      },
    };

    await createDefaultAzureCredential(localAzureConfiguration, () =>
      Promise.resolve(identityModule),
    );

    expect(defaultCredentialCount).toBe(1);
    expect(managedCredentialCount).toBe(0);
  });
});
