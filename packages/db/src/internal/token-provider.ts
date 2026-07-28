import type {
  AzureManagedIdentityDatabaseConfiguration,
  LocalAzureCredentialDatabaseConfiguration,
} from "@repo/env/server";

export const POSTGRES_AZURE_SCOPE = "https://ossrdbms-aad.database.windows.net/.default" as const;

export interface AccessToken {
  readonly token: string;
  readonly expiresOnTimestamp: number;
}

export interface TokenCredential {
  getToken(scope: string): Promise<AccessToken | null>;
}

export interface DatabasePasswordProvider {
  getPassword(): Promise<string>;
}

export type AzureDatabaseConfiguration =
  AzureManagedIdentityDatabaseConfiguration | LocalAzureCredentialDatabaseConfiguration;

export type AzureCredentialFactory = (
  configuration: AzureDatabaseConfiguration,
) => Promise<TokenCredential>;

export interface AzureIdentityModule {
  readonly DefaultAzureCredential: new () => TokenCredential;
  readonly ManagedIdentityCredential: new (options: {
    readonly clientId: string;
  }) => TokenCredential;
}

export type AzureIdentityLoader = () => Promise<AzureIdentityModule>;

export interface RefreshingTokenProviderOptions {
  readonly now?: () => number;
  readonly refreshSkewMs?: number;
}

export class DatabaseAuthenticationError extends Error {
  constructor() {
    super("A database access token could not be obtained.");
    this.name = "DatabaseAuthenticationError";
  }
}

export class RefreshingTokenProvider implements DatabasePasswordProvider {
  readonly #credentialFactory: () => Promise<TokenCredential>;
  readonly #now: () => number;
  readonly #refreshSkewMs: number;
  #credentialPromise: Promise<TokenCredential> | undefined;
  #cachedToken: AccessToken | undefined;
  #refreshPromise: Promise<AccessToken> | undefined;

  constructor(
    credentialFactory: () => Promise<TokenCredential>,
    options: RefreshingTokenProviderOptions = {},
  ) {
    this.#credentialFactory = credentialFactory;
    this.#now = options.now ?? Date.now;
    this.#refreshSkewMs = options.refreshSkewMs ?? 120_000;
  }

  async #getCredential(): Promise<TokenCredential> {
    const credential = (this.#credentialPromise ??= this.#credentialFactory());
    try {
      return await credential;
    } catch (error: unknown) {
      if (this.#credentialPromise === credential) {
        this.#credentialPromise = undefined;
      }
      throw error;
    }
  }

  async #refreshToken(): Promise<AccessToken> {
    const credential = await this.#getCredential();
    const token = await credential.getToken(POSTGRES_AZURE_SCOPE);

    if (token === null || token.token.length === 0 || token.expiresOnTimestamp <= this.#now()) {
      throw new DatabaseAuthenticationError();
    }

    this.#cachedToken = token;
    return token;
  }

  async getPassword(): Promise<string> {
    if (
      this.#cachedToken !== undefined &&
      this.#cachedToken.expiresOnTimestamp - this.#refreshSkewMs > this.#now()
    ) {
      return this.#cachedToken.token;
    }

    const refresh = (this.#refreshPromise ??= this.#refreshToken());
    try {
      return (await refresh).token;
    } finally {
      if (this.#refreshPromise === refresh) {
        this.#refreshPromise = undefined;
      }
    }
  }
}

const loadAzureIdentity: AzureIdentityLoader = () => import("@azure/identity");

export async function createDefaultAzureCredential(
  configuration: AzureDatabaseConfiguration,
  loadIdentity: AzureIdentityLoader = loadAzureIdentity,
): Promise<TokenCredential> {
  const { DefaultAzureCredential, ManagedIdentityCredential } = await loadIdentity();

  switch (configuration.mode) {
    case "azure-managed-identity":
      return new ManagedIdentityCredential({
        clientId: configuration.managedIdentityClientId,
      });
    case "local-azure-credential":
      return new DefaultAzureCredential();
  }
}

export function createAzureTokenProvider(
  configuration: AzureDatabaseConfiguration,
  credentialFactory: AzureCredentialFactory = createDefaultAzureCredential,
  options: RefreshingTokenProviderOptions = {},
): DatabasePasswordProvider {
  return new RefreshingTokenProvider(() => credentialFactory(configuration), options);
}
