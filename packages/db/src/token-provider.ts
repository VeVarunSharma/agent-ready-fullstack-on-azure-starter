import "server-only";

export {
  DatabaseAuthenticationError,
  POSTGRES_AZURE_SCOPE,
  RefreshingTokenProvider,
  createAzureTokenProvider,
  createDefaultAzureCredential,
} from "./internal/token-provider";

export type {
  AccessToken,
  AzureCredentialFactory,
  AzureDatabaseConfiguration,
  AzureIdentityLoader,
  AzureIdentityModule,
  DatabasePasswordProvider,
  RefreshingTokenProviderOptions,
  TokenCredential,
} from "./internal/token-provider";
