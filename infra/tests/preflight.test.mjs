import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  getMonitoringPreflightPosture,
  runCli,
  validateCompileOnlyConfig,
  validateProductionConfig,
} from "../scripts/preflight.mjs";

const compileFixtureUrl = new URL("../environments/compile.config.json", import.meta.url);
const productionFixtureUrl = new URL("../environments/production.config.json", import.meta.url);
const containerAppsTemplateUrl = new URL("../modules/container-apps.bicep", import.meta.url);
const dataTemplateUrl = new URL("../modules/data.bicep", import.meta.url);
const foundryTemplateUrl = new URL("../modules/foundry.bicep", import.meta.url);
const ingressTemplateUrl = new URL("../modules/ingress.bicep", import.meta.url);
const mainTemplateUrl = new URL("../main.bicep", import.meta.url);
const monitoringTemplateUrl = new URL("../modules/monitoring.bicep", import.meta.url);
const networkTemplateUrl = new URL("../modules/network.bicep", import.meta.url);
const platformTemplateUrl = new URL("../modules/platform.bicep", import.meta.url);
const registryTemplateUrl = new URL("../modules/registry.bicep", import.meta.url);
const securityTemplateUrl = new URL("../modules/security.bicep", import.meta.url);
const bicepCliUrl = new URL("../.tools/bicep", import.meta.url);
const dockerfileUrl = new URL("../../Dockerfile", import.meta.url);
const composeUrl = new URL("../../compose.yaml", import.meta.url);
const azureYamlUrl = new URL("../../azure.yaml", import.meta.url);
const deployWorkflowUrl = new URL("../../.github/workflows/deploy.yml", import.meta.url);

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

async function validProductionConfig() {
  const replaceCompileMarkers = (value) => {
    if (Array.isArray(value)) {
      return value.map(replaceCompileMarkers);
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, replaceCompileMarkers(child)]),
      );
    }
    if (typeof value !== "string") {
      return value;
    }
    return value
      .replaceAll("test-region-1", "eastus2")
      .replaceAll("example.test", "approved-domain.net")
      .replaceAll("compile-only", "release")
      .replaceAll("synthetic", "regulated")
      .replaceAll("compile", "prod")
      .replaceAll("foundation", "platformcore");
  };

  const config = replaceCompileMarkers(await readJson(compileFixtureUrl));
  delete config.nonProduction;
  config.deploymentProfile = "production";
  config.environmentName = "production";
  config.tags.purpose = "production-validation";
  config.egress.mode = "azureFirewall";
  config.egress.outboundControlApproved = true;
  config.features.enableFirewall = true;
  config.features.enableDiagnostics = true;
  config.monitoring.amplsNonRegionalControlPlaneApproved = true;
  config.monitoring.amplsNonRegionalApprovalReference = "ADR-0042-AMPLS-CONTROL-PLANE";
  config.monitoring.regionalDestinationApproved = true;
  config.monitoring.regionalDestinationApprovalReference = "ADR-0043-MONITORING-REGION";
  config.monitoring.retentionApproved = true;
  config.monitoring.retentionApprovalReference = "ADR-0044-MONITORING-RETENTION";
  config.monitoring.runtimeExporter.postureApproved = true;
  config.monitoring.runtimeExporter.approvalReference = "RISK-0045-DISABLED-TRACE-EXPORT";
  config.monitoring.dataCollection.decisionApproved = true;
  config.monitoring.dataCollection.approvalReference = "ADR-0046-NO-DCE-DCR";
  config.monitoring.queryAccess.principalId = "2b5f3f60-0d34-4f6a-bf2c-c849bb4b7d65";
  config.monitoring.queryAccess.clientId = "c112f700-38d8-4a11-910c-4b9cbce35db4";
  config.monitoring.queryAccess.roleAssignmentApproved = true;
  config.monitoring.queryAccess.approvalReference = "IAM-0047-ROLLOUT-LOG-QUERY";
  config.diagnostics.categoriesVerified = true;
  config.diagnostics.approvalReference = "DATA-0048-DIAGNOSTIC-CATEGORIES";
  config.dns.domainOwnershipApproved = true;
  config.tls.ownershipApproved = true;
  config.auth.forwardedHostTrustApproved = true;
  config.accessPolicies.diagnosticDataApproved = true;
  config.delivery.privateAcrRunnerType = "vnetConnected";
  config.delivery.privateAcrRunnerApproved = true;
  config.image.tag = "8f13c5a79d2046be31a7f860cd9254e18b3a670d";
  config.postgres.entraAdministratorObjectId = "a21476bc-63d9-4e58-924f-c37015bd8a62";
  config.auth.tenantId = "39c8b127-5a64-4d2e-a973-16f20bc84d51";
  config.auth.clientId = "c54e0a29-7d13-48bc-86f2-91a635e7d40b";
  config.auth.allowedIdentities = ["de40f179-2b86-435a-a71c-9036e52bd814"];
  config.auth.issuer =
    "https://login.microsoftonline.com/39c8b127-5a64-4d2e-a973-16f20bc84d51/v2.0";
  config.tls.certificateVersionedSecretUri = `https://${config.names.keyVault}.vault.azure.net/secrets/gateway-tls/7fd82a951c4e6380b16da9275e34f062`;
  config.auth.clientSecretKeyVaultUrl = `https://${config.names.keyVault}.vault.azure.net/secrets/oidc-client/0c6db12fe78943a5bd761ea934c2580f`;
  return config;
}

function hasCode(errors, code) {
  return errors.some((error) => error.code === code);
}

function countCode(errors, code) {
  return errors.filter((error) => error.code === code).length;
}

function compileBicep(templateUrl) {
  return JSON.parse(
    execFileSync(
      fileURLToPath(bicepCliUrl),
      ["build", fileURLToPath(templateUrl), "--stdout", "--no-restore"],
      { encoding: "utf8" },
    ),
  );
}

function findResource(template, type) {
  const resource = template.resources.find((candidate) => candidate.type === type);
  assert.ok(resource, `Expected compiled resource ${type}`);
  return resource;
}

function environmentMap(container) {
  return Object.fromEntries(container.env.map(({ name, value }) => [name, value]));
}

test("allows a complete restricted regional production configuration", async () => {
  const errors = validateProductionConfig(await validProductionConfig());
  assert.deepEqual(errors, []);
});

test("disabled Foundry has no production input requirements", async () => {
  const config = await validProductionConfig();
  assert.equal(config.features.enableFoundry, false);
  assert.equal(config.foundry, undefined);
  assert.equal(config.resourceLocations.foundry, undefined);
  assert.equal(config.names.foundryAccount, undefined);
  assert.equal(config.network.subnets.foundryAgents, undefined);
  assert.equal(config.diagnostics.foundry, undefined);
  assert.equal(config.dataPlanes.foundryPublicAccess, undefined);
  assert.deepEqual(validateProductionConfig(config), []);
});

test("compile fixtures require explicit isolated nonproduction mode", async () => {
  const compileFixture = await readJson(compileFixtureUrl);
  assert.deepEqual(validateCompileOnlyConfig(compileFixture), []);

  const productionErrors = validateProductionConfig(compileFixture);
  assert.ok(hasCode(productionErrors, "PRODUCTION_PROFILE_REQUIRED"));
  assert.ok(hasCode(productionErrors, "SYNTHETIC_VALUE_PROHIBITED"));
  assert.equal(await runCli(["--config", compileFixtureUrl.pathname, "--quiet"]), 1);
  assert.equal(
    await runCli(["--config", compileFixtureUrl.pathname, "--mode", "compile-only", "--quiet"]),
    0,
  );

  const production = await validProductionConfig();
  assert.ok(hasCode(validateCompileOnlyConfig(production), "COMPILE_ONLY_PROFILE_REQUIRED"));

  const foundryCompileFixture = structuredClone(compileFixture);
  foundryCompileFixture.features.enableFoundry = true;
  assert.ok(
    hasCode(validateCompileOnlyConfig(foundryCompileFixture), "COMPILE_ONLY_FOUNDRY_PROHIBITED"),
  );
});

test("Bicep emits no disabled Foundry resources, DNS, RBAC, data planes, or subnet", () => {
  const foundry = compileBicep(foundryTemplateUrl);
  assert.deepEqual(foundry.resources, []);
  assert.deepEqual(foundry.parameters.enableFoundry.allowedValues, [false]);

  const platform = compileBicep(platformTemplateUrl);
  const boundary = platform.resources.find(
    ({ name, type }) =>
      type === "Microsoft.Resources/deployments" && name === "foundry-nondeployable-boundary",
  );
  assert.ok(boundary);
  assert.equal(boundary.condition, "[parameters('enableFoundry')]");
  assert.deepEqual(boundary.properties.template.resources, []);
  assert.deepEqual(boundary.properties.template.parameters.enableFoundry.allowedValues, [false]);
  assert.doesNotMatch(
    platform.variables.allPrivateDnsZones,
    /cognitiveservices|documents\.azure|openai|search\.windows|services\.ai/iu,
  );

  const network = compileBicep(networkTemplateUrl);
  assert.doesNotMatch(JSON.stringify(network), /foundry|foundryAgents/iu);

  const main = compileBicep(mainTemplateUrl);
  assert.match(main.variables.deploymentAllowed, /deploymentProfile.*production/iu);
  assert.ok(
    main.resources.every(({ condition }) => condition === "[variables('deploymentAllowed')]"),
  );
});

test("compiled application, database, image, and migration contracts match runtime", async () => {
  const containerApps = compileBicep(containerAppsTemplateUrl);
  const webApp = findResource(containerApps, "Microsoft.App/containerApps");
  const webContainer = webApp.properties.template.containers[0];
  assert.deepEqual(Object.keys(webApp.identity.userAssignedIdentities), [
    "[format('{0}', parameters('appIdentityId'))]",
  ]);
  assert.equal(
    webApp.properties.configuration.secrets[0].keyVaultUrl,
    "[parameters('auth').clientSecretKeyVaultUrl]",
  );
  assert.equal(
    webApp.properties.configuration.secrets[0].identity,
    "[parameters('appIdentityId')]",
  );
  assert.deepEqual(environmentMap(webContainer), {
    NODE_ENV: "production",
    PORT: "[string(parameters('containerApps').app.targetPort)]",
    RUNTIME_MODE: "production",
    AZURE_CLIENT_ID: "[parameters('appIdentityClientId')]",
    DATABASE_MODE: "azure-managed-identity",
    DATABASE_HOST: "[parameters('database').host]",
    DATABASE_PORT: "5432",
    DATABASE_NAME: "[parameters('database').name]",
    DATABASE_USER: "[parameters('database').appPrincipalName]",
    DATABASE_POOL_MAX: "10",
    DATABASE_PROBE_TIMEOUT_MS: "2000",
    AUTH_MODE: "container-apps",
    LOGGING_MODE: "json",
    TELEMETRY_MODE: "disabled",
  });
  assert.equal(
    webApp.properties.configuration.ingress.targetPort,
    "[parameters('containerApps').app.targetPort]",
  );
  assert.deepEqual(
    webContainer.probes.map(({ httpGet, type }) => ({
      path: httpGet.path,
      port: httpGet.port,
      type,
    })),
    [
      {
        path: "/health/live",
        port: "[parameters('containerApps').app.targetPort]",
        type: "Liveness",
      },
      {
        path: "/health/ready",
        port: "[parameters('containerApps').app.targetPort]",
        type: "Readiness",
      },
    ],
  );

  const auth = findResource(containerApps, "Microsoft.App/containerApps/authConfigs");
  assert.deepEqual(auth.properties.globalValidation.excludedPaths, [
    "/health/live",
    "/health/ready",
  ]);
  assert.equal(
    auth.properties.login.allowedExternalRedirectUrls,
    "[parameters('auth').callbackUrls]",
  );
  assert.equal(auth.properties.platform.enabled, true);
  const entraProvider = containerApps.variables.entraIdentityProvider.azureActiveDirectory;
  assert.equal(entraProvider.registration.clientId, "[parameters('auth').clientId]");
  assert.equal(entraProvider.registration.openIdIssuer, "[parameters('auth').issuer]");
  assert.deepEqual(entraProvider.validation.allowedAudiences, ["[parameters('auth').audience]"]);
  assert.equal(
    entraProvider.validation.defaultAuthorizationPolicy.allowedPrincipals.identities,
    "[parameters('auth').allowedIdentities]",
  );

  const migrationJob = findResource(containerApps, "Microsoft.App/jobs");
  const migrationContainer = migrationJob.properties.template.containers[0];
  assert.deepEqual(Object.keys(migrationJob.identity.userAssignedIdentities), [
    "[format('{0}', parameters('migrationIdentityId'))]",
  ]);
  assert.equal(migrationJob.properties.configuration.triggerType, "Manual");
  assert.equal(migrationJob.properties.configuration.manualTriggerConfig.parallelism, 1);
  assert.equal(migrationJob.properties.configuration.manualTriggerConfig.replicaCompletionCount, 1);
  assert.equal(migrationContainer.command, "[parameters('image').migrationCommand]");
  assert.equal(migrationContainer.args, "[parameters('image').migrationArguments]");
  assert.deepEqual(environmentMap(migrationContainer), {
    NODE_ENV: "production",
    RUNTIME_MODE: "production",
    AZURE_CLIENT_ID: "[parameters('migrationIdentityClientId')]",
    DATABASE_MODE: "azure-managed-identity",
    DATABASE_HOST: "[parameters('database').host]",
    DATABASE_PORT: "5432",
    DATABASE_NAME: "[parameters('database').name]",
    DATABASE_USER: "[parameters('database').migrationPrincipalName]",
    DATABASE_POOL_MAX: "10",
    DATABASE_PROBE_TIMEOUT_MS: "2000",
    AUTH_MODE: "container-apps",
    LOGGING_MODE: "json",
    TELEMETRY_MODE: "disabled",
  });
  assert.equal(webContainer.image, "[variables('imageReference')]");
  assert.equal(migrationContainer.image, "[variables('imageReference')]");
  assert.match(containerApps.variables.imageReference, /registryLoginServer/u);
  assert.match(containerApps.variables.imageReference, /repository/u);
  assert.match(containerApps.variables.imageReference, /imageDigest/u);

  const database = compileBicep(dataTemplateUrl);
  const postgres = findResource(database, "Microsoft.DBforPostgreSQL/flexibleServers");
  assert.equal(postgres.properties.authConfig.activeDirectoryAuth, "Enabled");
  assert.equal(postgres.properties.authConfig.passwordAuth, "Disabled");
  assert.equal(postgres.properties.network.publicNetworkAccess, "Disabled");
  const configurations = database.resources.filter(
    ({ type }) => type === "Microsoft.DBforPostgreSQL/flexibleServers/configurations",
  );
  assert.ok(
    configurations.some(
      ({ name, properties }) =>
        name.includes("require_secure_transport") && properties.value === "on",
    ),
  );
  assert.ok(
    configurations.some(
      ({ name, properties }) =>
        name.includes("ssl_min_protocol_version") &&
        properties.value === "[parameters('postgres').minimumTlsVersion]",
    ),
  );
  assert.match(database.outputs.postgresHost.value, /postgres\.database\.azure\.com/u);

  const ingress = compileBicep(ingressTemplateUrl);
  const gateway = findResource(ingress, "Microsoft.Network/applicationGateways");
  const readinessProbe = gateway.properties.probes[0].properties;
  assert.equal(readinessProbe.path, "/health/ready");
  assert.equal(readinessProbe.port, 443);
  assert.equal(readinessProbe.protocol, "Https");
  const backendSettings = gateway.properties.backendHttpSettingsCollection[0].properties;
  assert.equal(backendSettings.port, 443);
  assert.equal(backendSettings.protocol, "Https");
  assert.equal(backendSettings.validateCertChainAndExpiry, true);
  assert.equal(backendSettings.validateSNI, true);

  const compileFixture = await readJson(compileFixtureUrl);
  assert.equal(compileFixture.containerApps.app.targetPort, 3000);
  assert.deepEqual(compileFixture.image.migrationCommand, ["node"]);
  assert.deepEqual(compileFixture.image.migrationArguments, [
    "migration/dist/migrate-production.mjs",
  ]);

  const dockerfile = await readFile(dockerfileUrl, "utf8");
  assert.match(dockerfile, /HOSTNAME=0\.0\.0\.0/u);
  assert.match(dockerfile, /NEXT_PUBLIC_RUNTIME_MODE=production/u);
  assert.match(dockerfile, /NODE_ENV=production/u);
  assert.match(dockerfile, /PORT=3000/u);
  assert.match(dockerfile, /EXPOSE 3000/u);
  assert.match(dockerfile, /packages\/db\/dist \.\/migration\/dist/u);
  assert.match(dockerfile, /packages\/db\/migrations \.\/migration\/migrations/u);
  assert.match(dockerfile, /\/health\/live/u);
  assert.match(dockerfile, /CMD \["node", "apps\/web\/server\.js"\]/u);

  const compose = await readFile(composeUrl, "utf8");
  assert.match(compose, /POSTGRES_DB: foundation_local/u);
  assert.match(compose, /POSTGRES_USER: foundation_local/u);
  assert.match(compose, /POSTGRES_PASSWORD: local-only-do-not-use-in-production/u);
  assert.match(compose, /"127\.0\.0\.1:5432:5432"/u);

  const azureYaml = await readFile(azureYamlUrl, "utf8");
  assert.match(azureYaml, /module: main/u);
  assert.match(azureYaml, /services: \{\}/u);
  assert.match(azureYaml, /infra\/environments\/production\.config\.json/u);
});

test("compiled monitoring routes structured Container Apps logs to one private regional workspace", () => {
  const monitoring = compileBicep(monitoringTemplateUrl);
  const workspace = findResource(monitoring, "Microsoft.OperationalInsights/workspaces");
  assert.equal(workspace.location, "[parameters('location')]");
  assert.equal(workspace.properties.features.disableLocalAuth, true);
  assert.equal(workspace.properties.features.enableLogAccessUsingOnlyResourcePermissions, true);
  assert.equal(workspace.properties.publicNetworkAccessForIngestion, "Disabled");
  assert.equal(workspace.properties.publicNetworkAccessForQuery, "Disabled");
  assert.equal(workspace.properties.retentionInDays, "[parameters('monitoring').logRetentionDays]");

  const applicationInsights = findResource(monitoring, "Microsoft.Insights/components");
  assert.equal(applicationInsights.location, "[parameters('location')]");
  assert.equal(applicationInsights.properties.DisableLocalAuth, true);
  assert.equal(applicationInsights.properties.IngestionMode, "LogAnalytics");
  assert.equal(
    applicationInsights.properties.WorkspaceResourceId,
    "[resourceId('Microsoft.OperationalInsights/workspaces', parameters('names').logAnalytics)]",
  );
  assert.equal(applicationInsights.properties.publicNetworkAccessForIngestion, "Disabled");
  assert.equal(applicationInsights.properties.publicNetworkAccessForQuery, "Disabled");

  const ampls = findResource(monitoring, "Microsoft.Insights/privateLinkScopes");
  assert.equal(ampls.location, "[parameters('amplsLocation')]");
  assert.equal(ampls.properties.accessModeSettings.ingestionAccessMode, "PrivateOnly");
  assert.equal(ampls.properties.accessModeSettings.queryAccessMode, "PrivateOnly");

  const queryRole = findResource(monitoring, "Microsoft.Authorization/roleAssignments");
  assert.equal(
    monitoring.variables.logAnalyticsDataReaderRoleId,
    "[subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '3b03c2da-16b3-4a49-8834-0f8130efdd3b')]",
  );
  assert.equal(
    queryRole.properties.roleDefinitionId,
    "[variables('logAnalyticsDataReaderRoleId')]",
  );
  assert.equal(
    queryRole.properties.principalId,
    "[parameters('monitoring').queryAccess.principalId]",
  );
  assert.equal(queryRole.properties.principalType, "ServicePrincipal");
  assert.doesNotMatch(
    JSON.stringify(monitoring.resources),
    /dataCollectionEndpoints|dataCollectionRules/iu,
  );

  const containerApps = compileBicep(containerAppsTemplateUrl);
  const environment = findResource(containerApps, "Microsoft.App/managedEnvironments");
  assert.equal(environment.properties.appLogsConfiguration.destination, "azure-monitor");
  const diagnosticSettings = containerApps.resources.filter(
    ({ type }) => type.toLowerCase() === "microsoft.insights/diagnosticsettings",
  );
  assert.equal(diagnosticSettings.length, 2);
  const environmentDiagnostics = diagnosticSettings.find(({ scope }) =>
    scope.includes("managedEnvironments"),
  );
  const appDiagnostics = diagnosticSettings.find(({ scope }) =>
    scope.includes("Microsoft.App/containerApps"),
  );
  assert.ok(environmentDiagnostics);
  assert.ok(appDiagnostics);
  assert.equal(environmentDiagnostics.condition, "[parameters('enableDiagnostics')]");
  assert.equal(
    environmentDiagnostics.properties.workspaceId,
    "[parameters('logAnalyticsWorkspaceId')]",
  );
  assert.match(environmentDiagnostics.properties.copy[0].count, /environmentDiagnosticCategories/u);
  assert.equal((appDiagnostics.properties.logs ?? []).length, 0);
  assert.equal(appDiagnostics.properties.metrics[0].enabled, true);

  for (const templateUrl of [
    securityTemplateUrl,
    registryTemplateUrl,
    dataTemplateUrl,
    ingressTemplateUrl,
  ]) {
    const template = compileBicep(templateUrl);
    const settings = template.resources.filter(
      ({ type }) => type.toLowerCase() === "microsoft.insights/diagnosticsettings",
    );
    assert.ok(settings.length > 0, fileURLToPath(templateUrl));
    for (const setting of settings) {
      assert.equal(setting.condition, "[parameters('enableDiagnostics')]");
      assert.equal(setting.properties.workspaceId, "[parameters('logAnalyticsWorkspaceId')]");
    }
  }
});

test("preflight exposes disabled export and external query controls machine-readably", async () => {
  const config = await validProductionConfig();
  const posture = getMonitoringPreflightPosture(config);

  assert.deepEqual(posture.applicationTraceExport, {
    disabledReason:
      "Stable @azure/monitor-opentelemetry@1.18.2 resolves prerelease @azure/monitor-opentelemetry-exporter@1.0.0-beta.43 and requires a Node --import loader incompatible with the Next.js 16 standalone entry point.",
    exporter: "none",
    runtimeTelemetryMode: "disabled",
    status: "scaffolded-disabled",
  });
  assert.deepEqual(posture.dataCollection, {
    dataCollectionEndpointRequired: false,
    dataCollectionRuleRequired: false,
  });
  assert.equal(posture.diagnostics.enabled, true);
  assert.deepEqual(posture.diagnostics.categories.containerAppsEnvironment, [
    "ContainerAppSystemLogs",
  ]);
  assert.deepEqual(posture.diagnostics.categories.containerApp, ["ContainerAppConsoleLogs"]);
  assert.deepEqual(posture.diagnostics.runtimeLogs, {
    destination: "regional-log-analytics-via-azure-monitor-diagnostics",
    enabled: true,
    format: "pii-safe-json-stdout",
  });
  assert.equal(posture.destination.location, config.primaryLocation);
  assert.equal(posture.destination.privateIngestion, true);
  assert.equal(posture.destination.privateQuery, true);
  assert.equal(posture.destination.publicIngestion, "Disabled");
  assert.equal(posture.destination.publicQuery, "Disabled");
  assert.equal(posture.destination.retentionInDays, config.monitoring.logRetentionDays);
  assert.equal(
    posture.externalControls[0].roleDefinitionId,
    "3b03c2da-16b3-4a49-8834-0f8130efdd3b",
  );
  assert.equal(posture.externalControls[2].name, "AZURE_MIGRATION_RUNTIME_CLIENT_ID");
});

test("rollout query targets the IaC diagnostic tables, exact revision, and reviewed identity", async () => {
  const workflow = await readFile(deployWorkflowUrl, "utf8");

  for (const table of [
    "ContainerAppConsoleLogs",
    "ContainerAppConsoleLogs_CL",
    "AzureDiagnostics",
  ]) {
    assert.match(workflow, new RegExp(`\\b${table}\\b`, "u"));
  }
  for (const filter of [
    "| where App == '{app}'",
    "| where Revision == '{revision}'",
    "| where tostring(Record.event) == 'telemetry.initialized'",
    "| where tostring(Record.telemetryMode) == 'disabled'",
  ]) {
    assert.ok(workflow.includes(filter), filter);
  }
  assert.ok(workflow.includes('.get("queryAccess", {})'));
  assert.ok(workflow.includes('.get("clientId", "")'));
  assert.ok(
    workflow.includes('query_client_id != os.environ["MIGRATION_RUNTIME_CLIENT_ID"].lower()'),
  );
  assert.ok(workflow.includes("client-id: ${{ vars.AZURE_MIGRATION_RUNTIME_CLIENT_ID }}"));
  assert.ok(workflow.includes("https://api.loganalytics.io/v1/workspaces/"));
});

test("checked-in production input fails every required preflight class", async () => {
  const errors = validateProductionConfig(await readJson(productionFixtureUrl));
  const requiredFailures = {
    residency: [
      "PRIMARY_LOCATION_REQUIRED",
      "APPROVED_LOCATIONS_REQUIRED",
      "RESOURCE_LOCATION_REQUIRED",
    ],
    auth: [
      "AUTH_PROVIDER_INVALID",
      "AUTH_ISSUER_REQUIRED",
      "AUTH_ISSUER_INVALID",
      "AUTH_AUDIENCE_REQUIRED",
      "AUTH_TENANT_INVALID",
      "AUTH_CLIENT_INVALID",
      "AUTH_SECRET_REFERENCE_INVALID",
      "AUTH_CALLBACK_REQUIRED",
      "ALLOWED_IDENTITIES_REQUIRED",
      "FORWARDED_HOST_TRUST_UNAPPROVED",
      "AUTH_COOKIE_EXPIRATION_INVALID",
      "AUTH_NONCE_EXPIRATION_INVALID",
      "PUBLIC_HOST_INVALID",
      "CALLBACK_HOST_INVALID",
      "DNS_OWNERSHIP_APPROVAL_REQUIRED",
      "TLS_CERTIFICATE_VERSION_REQUIRED",
      "TLS_CERTIFICATE_NAME_REQUIRED",
      "TLS_MINIMUM_VERSION_REQUIRED",
      "TLS_OWNERSHIP_APPROVAL_REQUIRED",
      "APPLICATION_GATEWAY_TLS_POLICY_REQUIRED",
    ],
    network: [
      "VNET_ADDRESS_SPACE_REQUIRED",
      "CIDR_INVALID",
      "CONTAINER_APPS_RESERVED_DNS_IP_INVALID",
      "PRIVATE_DNS_ZONE_REQUIRED",
      "PUBLIC_DATA_PLANE_PROHIBITED",
      "PRIVATE_MONITORING_REQUIRED",
      "PRIVATE_ACR_RUNNER_REQUIRED",
    ],
    sku: [
      "APPLICATION_GATEWAY_WAF_SKU_REQUIRED",
      "CONTAINER_APPS_SKU_REQUIRED",
      "ACR_PREMIUM_REQUIRED",
      "KEY_VAULT_SKU_REQUIRED",
      "POSTGRES_SKU_REQUIRED",
      "MONITORING_SKU_REQUIRED",
      "FIREWALL_SKU_REQUIRED",
    ],
    egress: [
      "EGRESS_MODE_UNAPPROVED",
      "EGRESS_APPROVAL_REQUIRED",
      "FIREWALL_REQUIRED_FOR_SELECTED_EGRESS",
      "FIREWALL_SKU_REQUIRED",
      "FIREWALL_ZONES_REQUIRED",
      "EGRESS_ALLOWLIST_REQUIRED",
    ],
    monitoring: [
      "LOG_RETENTION_INVALID",
      "APPLICATION_INSIGHTS_RETENTION_INVALID",
      "MONITORING_DAILY_QUOTA_INVALID",
      "MONITORING_REGIONAL_DESTINATION_APPROVAL_REQUIRED",
      "MONITORING_RETENTION_APPROVAL_REQUIRED",
      "AMPLS_NONREGIONAL_APPROVAL_REQUIRED",
      "RUNTIME_TELEMETRY_POSTURE_APPROVAL_REQUIRED",
      "MONITORING_DATA_COLLECTION_DECISION_APPROVAL_REQUIRED",
      "MONITORING_QUERY_IDENTITY_INVALID",
      "MONITORING_QUERY_ROLE_APPROVAL_REQUIRED",
      "DIAGNOSTIC_APPROVAL_REFERENCE_REQUIRED",
      "DIAGNOSTICS_REQUIRED",
    ],
  };

  for (const [failureClass, codes] of Object.entries(requiredFailures)) {
    for (const code of codes) {
      assert.ok(hasCode(errors, code), `${failureClass} fixture must emit ${code}`);
    }
  }

  assert.equal(countCode(errors, "RESOURCE_LOCATION_REQUIRED"), 6);
  assert.equal(countCode(errors, "RESOURCE_NAME_REQUIRED"), 34);
  assert.equal(countCode(errors, "CIDR_INVALID"), 6);
  assert.equal(countCode(errors, "PRIVATE_DNS_ZONE_REQUIRED"), 8);
  assert.equal(countCode(errors, "PUBLIC_DATA_PLANE_PROHIBITED"), 5);
  assert.equal(countCode(errors, "CONTAINER_APPS_SKU_REQUIRED"), 2);
  assert.equal(countCode(errors, "POSTGRES_SKU_REQUIRED"), 2);
});

test("CLI succeeds only when the incomplete production fixture is expected to fail", async () => {
  assert.equal(
    await runCli(["--config", productionFixtureUrl.pathname, "--expect-failure", "--quiet"]),
    0,
  );
  assert.equal(await runCli(["--config", productionFixtureUrl.pathname, "--quiet"]), 1);
});

test("rejects missing and unapproved regional locations", async () => {
  const missing = await validProductionConfig();
  missing.primaryLocation = "";
  assert.ok(hasCode(validateProductionConfig(missing), "PRIMARY_LOCATION_REQUIRED"));

  const unapproved = await validProductionConfig();
  unapproved.resourceLocations.data = "test-region-2";
  assert.ok(hasCode(validateProductionConfig(unapproved), "RESOURCE_LOCATION_NOT_APPROVED"));

  const unapprovedPrimary = await validProductionConfig();
  unapprovedPrimary.primaryLocation = "test-region-2";
  assert.ok(hasCode(validateProductionConfig(unapprovedPrimary), "PRIMARY_LOCATION_NOT_APPROVED"));

  const globalApproval = await validProductionConfig();
  globalApproval.approvedLocations.push("global");
  assert.ok(hasCode(validateProductionConfig(globalApproval), "NONREGIONAL_LOCATION_PROHIBITED"));

  const duplicateApproval = await validProductionConfig();
  duplicateApproval.approvedLocations.push(duplicateApproval.primaryLocation);
  assert.ok(hasCode(validateProductionConfig(duplicateApproval), "APPROVED_LOCATIONS_DUPLICATE"));
});

test("canonical production preflight rejects every synthetic value class", async () => {
  const cases = [
    ["workload", "workloadName", (config) => (config.workloadName = "placeholder-workload")],
    ["domain", "dns.publicHost", (config) => (config.dns.publicHost = "service.example.com")],
    ["identity", "names.appIdentity", (config) => (config.names.appIdentity = "id-test")],
    ["image", "image.repository", (config) => (config.image.repository = "sample/web")],
    [
      "image SHA",
      "image.tag",
      (config) => (config.image.tag = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    ],
    [
      "tenant",
      "auth.tenantId",
      (config) => (config.auth.tenantId = "11111111-1111-4111-8111-111111111111"),
    ],
    [
      "subscription",
      "subscriptionId",
      (config) => (config.subscriptionId = "22222222-2222-4222-8222-222222222222"),
    ],
    [
      "resource",
      "names.resourceGroup",
      (config) => (config.names.resourceGroup = "rg-placeholder"),
    ],
    ["SKU", "containerRegistry.sku", (config) => (config.containerRegistry.sku = "test-sku")],
    [
      "callback",
      "auth.callbackUrls.0",
      (config) => (config.auth.callbackUrls = ["https://login.example.test/callback"]),
    ],
    ["location", "primaryLocation", (config) => (config.primaryLocation = "test-region-1")],
  ];

  for (const [label, expectedPath, mutate] of cases) {
    const config = await validProductionConfig();
    mutate(config);
    assert.ok(
      validateProductionConfig(config).some(
        (error) => error.code === "SYNTHETIC_VALUE_PROHIBITED" && error.path === expectedPath,
      ),
      label,
    );
  }
});

test("rejects Global and DataZone Foundry deployment types for Restricted data", async () => {
  for (const deploymentType of ["GlobalStandard", "DataZoneStandard", "data-zone-restricted"]) {
    const config = await validProductionConfig();
    config.foundry = { deploymentTypes: [deploymentType], modelDeployments: [] };
    assert.ok(
      hasCode(validateProductionConfig(config), "FOUNDRY_NONREGIONAL_DEPLOYMENT_PROHIBITED"),
      deploymentType,
    );
  }
});

test("rejects every model declaration and enabled Foundry boundary", async () => {
  const model = await validProductionConfig();
  model.foundry = {
    deploymentTypes: ["RegionalStandard"],
    modelDeployments: [{ deploymentType: "RegionalStandard", name: "selected-model" }],
  };
  assert.ok(hasCode(validateProductionConfig(model), "FOUNDRY_MODEL_DEPLOYMENT_OUT_OF_SCOPE"));

  const enabled = await validProductionConfig();
  enabled.features.enableFoundry = true;
  enabled.foundry = {
    deploymentTypes: [],
    enabled: true,
    modelDeployments: [],
  };
  const errors = validateProductionConfig(enabled);
  assert.ok(hasCode(errors, "FOUNDRY_MUST_REMAIN_DISABLED"));
  assert.ok(hasCode(errors, "FOUNDRY_REGIONAL_STANDARD_POLICY_REQUIRED"));
  assert.equal(countCode(errors, "FOUNDRY_GATE_INCOMPLETE"), 16);

  const approvalFields = [
    "outboundControlApproved",
    "regionEligibilityVerified",
    "regionApproved",
    "providerRegistrationVerified",
    "accountEligibilityVerified",
    "deploymentTypeApproved",
    "termsApproved",
    "abuseMonitoringApproved",
    "contentLoggingControlVerified",
    "statefulFeaturesApproved",
    "retentionPolicyApproved",
    "deletionPolicyApproved",
    "promptStoreApproved",
    "completionStoreApproved",
    "traceStoreApproved",
    "evaluationStoreApproved",
  ];
  for (const field of approvalFields) {
    assert.ok(
      errors.some(
        (error) => error.code === "FOUNDRY_GATE_INCOMPLETE" && error.path === `foundry.${field}`,
      ),
      field,
    );
  }

  const fullyApprovedButUnsupported = structuredClone(enabled);
  fullyApprovedButUnsupported.foundry.deploymentTypes = ["RegionalStandard"];
  for (const field of approvalFields) {
    fullyApprovedButUnsupported.foundry[field] = true;
  }
  const boundaryErrors = validateProductionConfig(fullyApprovedButUnsupported);
  assert.ok(hasCode(boundaryErrors, "FOUNDRY_MUST_REMAIN_DISABLED"));
  assert.equal(hasCode(boundaryErrors, "FOUNDRY_GATE_INCOMPLETE"), false);
  assert.equal(hasCode(boundaryErrors, "FOUNDRY_REGIONAL_STANDARD_POLICY_REQUIRED"), false);
  assert.equal(hasCode(boundaryErrors, "FOUNDRY_SKU_REQUIRED"), false);
});

test("rejects unapproved replicas and geo-backup locations", async () => {
  const replica = await validProductionConfig();
  replica.postgres.replicas = [{ approved: false, location: "test-region-2" }];
  const replicaErrors = validateProductionConfig(replica);
  assert.ok(hasCode(replicaErrors, "REPLICA_LOCATION_NOT_APPROVED"));
  assert.ok(hasCode(replicaErrors, "REPLICA_APPROVAL_REQUIRED"));

  const backup = await validProductionConfig();
  backup.postgres.geoRedundantBackup = "Enabled";
  backup.postgres.backupSecondaryLocation = "test-region-2";
  backup.postgres.geoBackupApproved = false;
  const backupErrors = validateProductionConfig(backup);
  assert.ok(hasCode(backupErrors, "GEO_BACKUP_LOCATION_NOT_APPROVED"));
  assert.ok(hasCode(backupErrors, "GEO_BACKUP_APPROVAL_REQUIRED"));

  const invalidBackupSetting = await validProductionConfig();
  invalidBackupSetting.postgres.geoRedundantBackup = "Unresolved";
  assert.ok(
    hasCode(validateProductionConfig(invalidBackupSetting), "POSTGRES_GEO_BACKUP_SETTING_INVALID"),
  );

  const invalidReplicaList = await validProductionConfig();
  invalidReplicaList.postgres.replicas = {};
  assert.ok(hasCode(validateProductionConfig(invalidReplicaList), "POSTGRES_REPLICA_LIST_INVALID"));
});

test("rejects an unapproved global request-processing edge", async () => {
  const config = await validProductionConfig();
  config.globalEdge.enabled = true;
  config.globalEdge.approvalReference = "";
  assert.ok(hasCode(validateProductionConfig(config), "GLOBAL_EDGE_UNAPPROVED"));
});

test("rejects incomplete authentication and host trust", async () => {
  const cases = [
    ["issuer", "", "AUTH_ISSUER_REQUIRED"],
    ["audience", "", "AUTH_AUDIENCE_REQUIRED"],
    ["tenantId", "", "AUTH_TENANT_INVALID"],
    ["clientId", "", "AUTH_CLIENT_INVALID"],
    ["allowedIdentities", [], "ALLOWED_IDENTITIES_REQUIRED"],
    ["forwardedHostTrustApproved", false, "FORWARDED_HOST_TRUST_UNAPPROVED"],
  ];

  for (const [field, value, expectedCode] of cases) {
    const config = await validProductionConfig();
    config.auth[field] = value;
    assert.ok(hasCode(validateProductionConfig(config), expectedCode), field);
  }

  const callbackHost = await validProductionConfig();
  callbackHost.dns.callbackHost = "other.example.test";
  assert.ok(hasCode(validateProductionConfig(callbackHost), "CALLBACK_HOST_MISMATCH"));

  const externalRedirect = await validProductionConfig();
  externalRedirect.auth.callbackUrls = ["https://other.example.test/after-login"];
  assert.ok(hasCode(validateProductionConfig(externalRedirect), "AUTH_CALLBACK_INVALID"));

  const issuerTenant = await validProductionConfig();
  issuerTenant.auth.issuer =
    "https://login.microsoftonline.com/44444444-4444-4444-8444-444444444444/v2.0";
  assert.ok(hasCode(validateProductionConfig(issuerTenant), "ENTRA_ISSUER_TENANT_MISMATCH"));

  const spoofedIssuer = await validProductionConfig();
  spoofedIssuer.auth.issuer =
    "https://login.microsoftonline.com.example.test/11111111-1111-4111-8111-111111111111/v2.0";
  assert.ok(hasCode(validateProductionConfig(spoofedIssuer), "ENTRA_ISSUER_HOST_INVALID"));

  const malformedPrincipal = await validProductionConfig();
  malformedPrincipal.auth.allowedIdentities = ["not-a-uuid"];
  assert.ok(hasCode(validateProductionConfig(malformedPrincipal), "AUTH_PRINCIPAL_ID_INVALID"));

  const duplicatePrincipal = await validProductionConfig();
  duplicatePrincipal.auth.allowedGroups = [
    "33333333-3333-4333-8333-333333333333",
    "33333333-3333-4333-8333-333333333333",
  ];
  assert.ok(hasCode(validateProductionConfig(duplicatePrincipal), "AUTH_PRINCIPAL_ID_DUPLICATE"));

  const malformedList = await validProductionConfig();
  malformedList.auth.allowedClientApplications = "33333333-3333-4333-8333-333333333333";
  assert.ok(hasCode(validateProductionConfig(malformedList), "AUTH_PRINCIPAL_LIST_INVALID"));

  const sharedIdentity = await validProductionConfig();
  sharedIdentity.names.migrationIdentity = sharedIdentity.names.appIdentity;
  assert.ok(hasCode(validateProductionConfig(sharedIdentity), "MANAGED_IDENTITIES_NOT_DISTINCT"));

  const sharedDatabasePrincipal = await validProductionConfig();
  sharedDatabasePrincipal.postgres.migrationPrincipalName =
    sharedDatabasePrincipal.postgres.appPrincipalName;
  assert.ok(
    hasCode(validateProductionConfig(sharedDatabasePrincipal), "POSTGRES_PRINCIPALS_NOT_DISTINCT"),
  );
});

test("rejects custom OIDC without complete HTTPS discovery endpoints", async () => {
  const config = await validProductionConfig();
  config.auth.provider = "customOidc";
  config.auth.tokenEndpoint = "";
  const errors = validateProductionConfig(config);
  assert.ok(hasCode(errors, "CUSTOM_OIDC_CONFIGURATION_REQUIRED"));
  assert.ok(hasCode(errors, "CUSTOM_OIDC_ENDPOINT_INVALID"));
});

test("rejects every prohibited public data plane", async () => {
  const baseline = await validProductionConfig();
  for (const field of Object.keys(baseline.dataPlanes)) {
    const config = structuredClone(baseline);
    config.dataPlanes[field] = "Enabled";
    assert.ok(hasCode(validateProductionConfig(config), "PUBLIC_DATA_PLANE_PROHIBITED"), field);
  }
});

test("rejects missing names, DNS, TLS, SKU, image, and egress decisions", async () => {
  const names = await validProductionConfig();
  names.names.applicationGateway = "";
  assert.ok(hasCode(validateProductionConfig(names), "RESOURCE_NAME_REQUIRED"));

  const dns = await validProductionConfig();
  dns.dns.publicHost = "";
  assert.ok(hasCode(validateProductionConfig(dns), "PUBLIC_HOST_INVALID"));

  const tls = await validProductionConfig();
  tls.tls.certificateVersionedSecretUri =
    "https://kv-synthetic-compile.vault.azure.net/secrets/gateway-tls";
  assert.ok(hasCode(validateProductionConfig(tls), "TLS_CERTIFICATE_VERSION_REQUIRED"));

  const wrongVault = await validProductionConfig();
  wrongVault.tls.certificateVersionedSecretUri =
    "https://other-vault.vault.azure.net/secrets/gateway-tls/11111111111111111111111111111111";
  assert.ok(hasCode(validateProductionConfig(wrongVault), "TLS_CERTIFICATE_VAULT_MISMATCH"));

  const sku = await validProductionConfig();
  sku.containerRegistry.sku = "Basic";
  assert.ok(hasCode(validateProductionConfig(sku), "ACR_PREMIUM_REQUIRED"));

  const image = await validProductionConfig();
  image.image.migrationCommand = [];
  assert.ok(hasCode(validateProductionConfig(image), "MIGRATION_COMMAND_REQUIRED"));

  const mutableTag = await validProductionConfig();
  mutableTag.image.tag = "latest";
  assert.ok(hasCode(validateProductionConfig(mutableTag), "IMAGE_TAG_NOT_IMMUTABLE"));

  const wrongMigration = await validProductionConfig();
  wrongMigration.image.migrationArguments = ["apps/web/scripts/migrate.mjs"];
  assert.ok(hasCode(validateProductionConfig(wrongMigration), "MIGRATION_ARGUMENTS_INVALID"));

  const wrongPort = await validProductionConfig();
  wrongPort.containerApps.app.targetPort = 8080;
  assert.ok(hasCode(validateProductionConfig(wrongPort), "CONTAINER_APP_TARGET_PORT_INVALID"));

  const egress = await validProductionConfig();
  egress.egress.mode = "unresolved";
  assert.ok(hasCode(validateProductionConfig(egress), "EGRESS_MODE_UNAPPROVED"));
});

test("rejects unsupported SKUs and incomplete firewall egress", async () => {
  const config = await validProductionConfig();
  config.keyVault.sku = "free";
  config.postgres.skuTier = "Burstable";
  config.egress.firewall.skuTier = "Basic";
  config.egress.firewall.zones = ["1", "1"];
  config.egress.firewall.allowedFqdns = ["https://packages.example.test"];
  const errors = validateProductionConfig(config);

  for (const code of [
    "KEY_VAULT_SKU_INVALID",
    "POSTGRES_SKU_TIER_INVALID",
    "FIREWALL_SKU_INVALID",
    "FIREWALL_ZONES_REQUIRED",
    "EGRESS_ALLOWLIST_INVALID",
  ]) {
    assert.ok(hasCode(errors, code), code);
  }

  const duplicateAllowlist = await validProductionConfig();
  duplicateAllowlist.egress.firewall.allowedFqdns = [
    "packages.example.test",
    "PACKAGES.EXAMPLE.TEST",
  ];
  assert.ok(hasCode(validateProductionConfig(duplicateAllowlist), "EGRESS_ALLOWLIST_DUPLICATE"));

  const wildcardAllowlist = await validProductionConfig();
  wildcardAllowlist.egress.firewall.allowedFqdns = ["*.approved-domain.net"];
  assert.deepEqual(validateProductionConfig(wildcardAllowlist), []);
});

test("rejects overlapping, malformed, and out-of-VNet address ranges", async () => {
  const overlap = await validProductionConfig();
  overlap.network.subnets.privateEndpoints = overlap.network.subnets.applicationGateway;
  assert.ok(hasCode(validateProductionConfig(overlap), "SUBNETS_OVERLAP"));

  const malformed = await validProductionConfig();
  malformed.network.subnets.privateEndpoints = "10.80.8.1/24";
  assert.ok(hasCode(validateProductionConfig(malformed), "CIDR_INVALID"));

  const emptyOctet = await validProductionConfig();
  emptyOctet.network.vnetAddressPrefixes = ["10..0.0/16"];
  assert.ok(hasCode(validateProductionConfig(emptyOctet), "CIDR_INVALID"));

  const leadingZero = await validProductionConfig();
  leadingZero.network.vnetAddressPrefixes = ["010.80.0.0/16"];
  assert.ok(hasCode(validateProductionConfig(leadingZero), "CIDR_INVALID"));

  const outside = await validProductionConfig();
  outside.network.subnets.containerApps = "10.90.0.0/23";
  assert.ok(hasCode(validateProductionConfig(outside), "SUBNET_OUTSIDE_VNET"));

  const platformOverlap = await validProductionConfig();
  platformOverlap.containerApps.network.dockerBridgeCidr = "10.80.20.0/24";
  assert.ok(hasCode(validateProductionConfig(platformOverlap), "PLATFORM_NETWORK_RANGES_OVERLAP"));

  const missingPrivateDns = await validProductionConfig();
  missingPrivateDns.privateDnsZones.azureMonitor = [];
  assert.equal(
    countCode(validateProductionConfig(missingPrivateDns), "PRIVATE_DNS_ZONE_REQUIRED"),
    5,
  );

  const invalidPrivateDns = await validProductionConfig();
  invalidPrivateDns.privateDnsZones.postgres = ["https://privatelink.postgres.database.azure.com"];
  assert.ok(hasCode(validateProductionConfig(invalidPrivateDns), "PRIVATE_DNS_ZONE_INVALID"));
});

test("rejects monitoring drift, unsafe categories, enabled export, and missing approvals", async () => {
  const wrongRegion = await validProductionConfig();
  wrongRegion.approvedLocations.push("westus3");
  wrongRegion.resourceLocations.monitoring = "westus3";
  assert.ok(hasCode(validateProductionConfig(wrongRegion), "MONITORING_LOCATION_MISMATCH"));

  const wrongNetworkRegion = await validProductionConfig();
  wrongNetworkRegion.approvedLocations.push("westus3");
  wrongNetworkRegion.resourceLocations.network = "westus3";
  assert.ok(hasCode(validateProductionConfig(wrongNetworkRegion), "MONITORING_LOCATION_MISMATCH"));

  const categoryDrift = await validProductionConfig();
  categoryDrift.diagnostics.containerAppsEnvironment.push("allLogs");
  assert.ok(
    hasCode(validateProductionConfig(categoryDrift), "DIAGNOSTIC_CATEGORY_ALLOWLIST_MISMATCH"),
  );

  const exporter = await validProductionConfig();
  exporter.monitoring.runtimeExporter.status = "enabled";
  exporter.monitoring.runtimeExporter.telemetryMode = "azure-monitor";
  exporter.monitoring.runtimeExporter.exporter = "@azure/monitor-opentelemetry";
  assert.ok(hasCode(validateProductionConfig(exporter), "RUNTIME_EXPORTER_MUST_REMAIN_DISABLED"));

  const rationale = await validProductionConfig();
  rationale.monitoring.runtimeExporter.disabledReason = "Exporter unavailable.";
  assert.ok(
    hasCode(validateProductionConfig(rationale), "RUNTIME_EXPORTER_DISABLED_REASON_INVALID"),
  );

  const dataCollection = await validProductionConfig();
  dataCollection.monitoring.dataCollection.dataCollectionEndpointRequired = true;
  assert.ok(
    hasCode(validateProductionConfig(dataCollection), "MONITORING_DATA_COLLECTION_SURFACE_INVALID"),
  );

  const missingApprovals = await validProductionConfig();
  missingApprovals.monitoring.regionalDestinationApproved = false;
  missingApprovals.monitoring.retentionApproved = false;
  missingApprovals.monitoring.runtimeExporter.postureApproved = false;
  missingApprovals.monitoring.dataCollection.decisionApproved = false;
  missingApprovals.monitoring.queryAccess.roleAssignmentApproved = false;
  missingApprovals.diagnostics.approvalReference = "";
  const approvalErrors = validateProductionConfig(missingApprovals);
  for (const code of [
    "MONITORING_REGIONAL_DESTINATION_APPROVAL_REQUIRED",
    "MONITORING_RETENTION_APPROVAL_REQUIRED",
    "RUNTIME_TELEMETRY_POSTURE_APPROVAL_REQUIRED",
    "MONITORING_DATA_COLLECTION_DECISION_APPROVAL_REQUIRED",
    "MONITORING_QUERY_ROLE_APPROVAL_REQUIRED",
    "DIAGNOSTIC_APPROVAL_REFERENCE_REQUIRED",
  ]) {
    assert.ok(hasCode(approvalErrors, code), code);
  }
});

test("rejects missing HA, backup, monitoring retention, diagnostics, and AMPLS approvals", async () => {
  const config = await validProductionConfig();
  config.postgres.highAvailabilityMode = "Disabled";
  config.postgres.backupRetentionDays = 0;
  config.applicationGateway.autoscale.minimumCapacity = 1;
  config.applicationGateway.zones = ["1", "1"];
  config.containerApps.zoneRedundant = false;
  config.containerApps.app.scale.minimumReplicas = 1;
  config.containerRegistry.zoneRedundancy = "Disabled";
  config.monitoring.logRetentionDays = 0;
  config.monitoring.applicationInsightsRetentionDays = 0;
  config.monitoring.privateIngestion = false;
  config.monitoring.amplsNonRegionalControlPlaneApproved = false;
  config.monitoring.amplsNonRegionalApprovalReference = "";
  config.diagnostics.categoriesVerified = false;
  config.diagnostics.keyVault = [];
  config.features.enableDiagnostics = false;
  config.features.enableAmpls = false;
  const errors = validateProductionConfig(config);

  for (const code of [
    "POSTGRES_HA_REQUIRED",
    "POSTGRES_BACKUP_RETENTION_INVALID",
    "APPLICATION_GATEWAY_HA_REQUIRED",
    "APPLICATION_GATEWAY_ZONES_REQUIRED",
    "CONTAINER_APPS_ZONE_REDUNDANCY_REQUIRED",
    "CONTAINER_APP_HA_REQUIRED",
    "ACR_ZONE_REDUNDANCY_REQUIRED",
    "LOG_RETENTION_INVALID",
    "APPLICATION_INSIGHTS_RETENTION_INVALID",
    "PRIVATE_MONITORING_REQUIRED",
    "AMPLS_NONREGIONAL_APPROVAL_REQUIRED",
    "DIAGNOSTIC_CATEGORIES_UNVERIFIED",
    "DIAGNOSTIC_CATEGORY_ALLOWLIST_MISMATCH",
    "DIAGNOSTICS_REQUIRED",
    "AMPLS_REQUIRED",
  ]) {
    assert.ok(hasCode(errors, code), code);
  }
});

test("rejects private ACR delivery without an approved VNet-connected runner", async () => {
  const config = await validProductionConfig();
  config.delivery.privateAcrRunnerType = "githubHosted";
  config.delivery.privateAcrRunnerApproved = false;
  assert.ok(hasCode(validateProductionConfig(config), "PRIVATE_ACR_RUNNER_REQUIRED"));
});

test("rejects mismatched ARM feature parameters", async () => {
  const config = await validProductionConfig();
  const document = {
    parameters: {
      config: { value: config },
      enableFoundry: { value: true },
    },
  };
  assert.ok(hasCode(validateProductionConfig(document), "FEATURE_PARAMETER_MISMATCH"));
});

test("returns deterministic sorted failures without mutating input", async () => {
  const config = await readJson(productionFixtureUrl);
  const original = structuredClone(config);
  const first = validateProductionConfig(config);
  const second = validateProductionConfig(config);

  assert.deepEqual(first, second);
  assert.deepEqual(config, original);
  assert.deepEqual(
    first,
    [...first].sort(
      (left, right) =>
        left.code.localeCompare(right.code) ||
        left.path.localeCompare(right.path) ||
        left.message.localeCompare(right.message),
    ),
  );
});

test("rejects malformed preflight document roots", () => {
  for (const document of [null, [], "production"]) {
    const errors = validateProductionConfig(document);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].code, "CONFIG_OBJECT_REQUIRED");
  }
});
