import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOST_PATTERN =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const OCI_REPOSITORY_PATTERN = /^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/;
const IMMUTABLE_IMAGE_TAG_PATTERN = /^[0-9a-f]{40}$/;
const AUTH_DURATION_PATTERN = /^\d{2,}:[0-5]\d:[0-5]\d$/;
const PRODUCTION_MIGRATION_COMMAND = ["node"];
const PRODUCTION_MIGRATION_ARGUMENTS = ["migration/dist/migrate-production.mjs"];
const SYNTHETIC_MARKER_PATTERN =
  /(?:^|[^a-z0-9])(?:changeme|change-me|compile|compile-only|dummy|example|fake|foundation|placeholder|replace-with|replace_with|replacewith|sample|synthetic|tbd|test|testing|todo|unresolved)(?:$|[^a-z0-9])/i;
const MICROSOFT_ENTRA_ISSUER_HOSTS = new Set([
  "login.chinacloudapi.cn",
  "login.microsoftonline.com",
  "login.microsoftonline.de",
  "login.microsoftonline.us",
  "login.partner.microsoftonline.cn",
  "sts.windows.net",
]);

const REQUIRED_RESOURCE_LOCATIONS = [
  "network",
  "security",
  "compute",
  "data",
  "monitoring",
  "ingress",
];

const REQUIRED_NAMES = [
  "resourceGroup",
  "virtualNetwork",
  "appGatewayNetworkSecurityGroup",
  "privateEndpointNetworkSecurityGroup",
  "appGatewaySubnet",
  "containerAppsSubnet",
  "privateEndpointSubnet",
  "firewallSubnet",
  "firewallPublicIp",
  "firewallPolicy",
  "firewall",
  "firewallRuleCollectionGroup",
  "workloadRouteTable",
  "logAnalytics",
  "applicationInsights",
  "monitorPrivateLinkScope",
  "appIdentity",
  "migrationIdentity",
  "gatewayIdentity",
  "keyVault",
  "containerRegistry",
  "postgresServer",
  "postgresDatabase",
  "containerAppsEnvironment",
  "containerAppsInfrastructureResourceGroup",
  "webContainerApp",
  "migrationJob",
  "applicationGatewayPublicIp",
  "applicationGatewayWafPolicy",
  "applicationGateway",
  "containerRegistryPrivateEndpoint",
  "keyVaultPrivateEndpoint",
  "postgresPrivateEndpoint",
  "monitorPrivateEndpoint",
];

const APPROVED_DIAGNOSTIC_CATEGORIES = {
  keyVault: ["AuditEvent"],
  containerRegistry: ["ContainerRegistryRepositoryEvents", "ContainerRegistryLoginEvents"],
  postgres: ["PostgreSQLLogs"],
  containerAppsEnvironment: ["ContainerAppSystemLogs"],
  containerApp: ["ContainerAppConsoleLogs"],
  applicationGateway: [
    "ApplicationGatewayAccessLog",
    "ApplicationGatewayPerformanceLog",
    "ApplicationGatewayFirewallLog",
  ],
};
const APPLICATION_INSIGHTS_RETENTION_VALUES = new Set([30, 60, 90, 120, 180, 270, 365, 550, 730]);
const LOG_ANALYTICS_DATA_READER_ROLE_ID = "3b03c2da-16b3-4a49-8834-0f8130efdd3b";
const RUNTIME_EXPORTER_DISABLED_REASON =
  "Stable @azure/monitor-opentelemetry@1.18.2 resolves prerelease @azure/monitor-opentelemetry-exporter@1.0.0-beta.43 and requires a Node --import loader incompatible with the Next.js 16 standalone entry point.";

const REQUIRED_PRIVATE_DNS_ZONES = {
  "privateDnsZones.containerRegistry": ["privatelink.azurecr.io"],
  "privateDnsZones.keyVault": ["privatelink.vaultcore.azure.net"],
  "privateDnsZones.postgres": ["privatelink.postgres.database.azure.com"],
  "privateDnsZones.azureMonitor": [
    "privatelink.monitor.azure.com",
    "privatelink.oms.opinsights.azure.com",
    "privatelink.ods.opinsights.azure.com",
    "privatelink.agentsvc.azure-automation.net",
    "privatelink.blob.core.windows.net",
  ],
};

const PRIVATE_DATA_PLANE_FIELDS = [
  "containerRegistryPublicAccess",
  "keyVaultPublicAccess",
  "postgresPublicAccess",
  "monitoringPublicIngestion",
  "monitoringPublicQuery",
];

const FOUNDRY_APPROVAL_GATES = [
  ["outboundControlApproved", "controlled outbound access"],
  ["regionEligibilityVerified", "regional service eligibility"],
  ["regionApproved", "the Restricted-data processing region"],
  ["providerRegistrationVerified", "required provider registrations"],
  ["accountEligibilityVerified", "account and subscription eligibility"],
  ["deploymentTypeApproved", "the RegionalStandard-only deployment policy"],
  ["termsApproved", "current product and data-processing terms"],
  ["abuseMonitoringApproved", "abuse-monitoring behavior"],
  ["contentLoggingControlVerified", "the required content-logging control"],
  ["statefulFeaturesApproved", "every enabled stateful feature"],
  ["retentionPolicyApproved", "retention for every data category"],
  ["deletionPolicyApproved", "deletion and verification for every data category"],
  ["promptStoreApproved", "prompt storage and handling"],
  ["completionStoreApproved", "completion storage and handling"],
  ["traceStoreApproved", "trace storage and handling"],
  ["evaluationStoreApproved", "evaluation storage and handling"],
];

function get(value, path) {
  return path.split(".").reduce((current, segment) => current?.[segment], value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isTrue(value) {
  return value === true;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function arraysContainSameUniqueStrings(left, right) {
  return (
    isStringArray(left) &&
    left.length === right.length &&
    new Set(left).size === left.length &&
    right.every((value) => left.includes(value))
  );
}

function normalizeLocation(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseIpv4Cidr(value) {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const [address, prefixText, ...rest] = value.split("/");
  if (
    rest.length > 0 ||
    prefixText === undefined ||
    !/^(?:0|[1-9]|[12]\d|3[0-2])$/.test(prefixText)
  ) {
    return null;
  }

  const prefix = Number(prefixText);
  const octetTexts = address?.split(".");
  const octets = octetTexts?.map(Number);
  if (
    octetTexts?.some((octet) => !/^(?:0|[1-9]\d{0,2})$/.test(octet)) ||
    octets?.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return null;
  }

  const addressNumber = octets.reduce((result, octet) => (result << 8n) + BigInt(octet), 0n);
  const size = 1n << BigInt(32 - prefix);
  const start = (addressNumber / size) * size;
  if (start !== addressNumber) {
    return null;
  }

  return {
    end: start + size - 1n,
    prefix,
    start,
  };
}

function rangesOverlap(left, right) {
  return left.start <= right.end && right.start <= left.end;
}

function rangeContains(parent, child) {
  return parent.start <= child.start && parent.end >= child.end;
}

function isHttpsUrl(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function hasDistinctZones(value, minimumCount = 2) {
  return (
    Array.isArray(value) &&
    value.length >= minimumCount &&
    value.every((zone) => typeof zone === "string" && /^[1-9]\d*$/.test(zone)) &&
    new Set(value).size === value.length
  );
}

function isFirewallFqdn(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const hostname = value.trim().toLowerCase();
  return HOST_PATTERN.test(hostname.startsWith("*.") ? hostname.slice(2) : hostname);
}

function urlHost(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function syntheticValueCategory(path) {
  const normalizedPath = path.toLowerCase();

  if (normalizedPath === "workloadname" || normalizedPath === "environmentname") {
    return "workload";
  }
  if (
    normalizedPath === "primarylocation" ||
    normalizedPath.startsWith("approvedlocations.") ||
    normalizedPath.startsWith("resourcelocations.") ||
    normalizedPath.endsWith(".location") ||
    normalizedPath.endsWith("location")
  ) {
    return "location";
  }
  if (normalizedPath === "dns.callbackhost" || normalizedPath.startsWith("auth.callbackurls.")) {
    return "callback";
  }
  if (normalizedPath.endsWith("tenantid") || normalizedPath.includes(".tenant.")) {
    return "tenant";
  }
  if (normalizedPath.includes("subscription")) {
    return "subscription";
  }
  if (normalizedPath.startsWith("image.")) {
    return "image";
  }
  if (
    normalizedPath.includes("sku") ||
    normalizedPath.endsWith(".tier") ||
    normalizedPath.includes("deploymenttype") ||
    normalizedPath.startsWith("containerapps.workloadprofile.")
  ) {
    return "SKU";
  }
  if (
    normalizedPath.includes("identity") ||
    normalizedPath.includes("principal") ||
    normalizedPath.endsWith("clientid") ||
    normalizedPath.includes("allowedclientapplications") ||
    normalizedPath.includes("allowedgroups")
  ) {
    return "identity";
  }
  if (
    normalizedPath.startsWith("names.") ||
    normalizedPath.includes("resourcegroup") ||
    normalizedPath.endsWith("resourceid") ||
    normalizedPath.endsWith("resourcename")
  ) {
    return "resource";
  }
  if (
    normalizedPath.includes("host") ||
    normalizedPath.includes("issuer") ||
    normalizedPath.includes("endpoint") ||
    normalizedPath.includes("fqdn") ||
    normalizedPath.includes("dnszone") ||
    normalizedPath.endsWith("url") ||
    normalizedPath.endsWith("uri")
  ) {
    return "domain";
  }
  return "configuration";
}

function isPlaceholderDomain(value) {
  let hostname;
  try {
    hostname = new URL(value).hostname;
  } catch {
    try {
      hostname = new URL(`https://${value.replace(/^\*\./u, "")}`).hostname;
    } catch {
      return false;
    }
  }

  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "example.com" ||
    normalized.endsWith(".example.com") ||
    normalized === "example.net" ||
    normalized.endsWith(".example.net") ||
    normalized === "example.org" ||
    normalized.endsWith(".example.org") ||
    normalized === "example.test" ||
    normalized.endsWith(".example.test") ||
    normalized === "test" ||
    normalized.endsWith(".test") ||
    normalized === "invalid" ||
    normalized.endsWith(".invalid")
  );
}

function isLowEntropyHex(value) {
  const normalized = value.toLowerCase().replaceAll("-", "");
  if (!/^[0-9a-f]{16,64}$/u.test(normalized)) {
    return false;
  }

  return (
    new Set(normalized).size <= 4 ||
    /^(?:0123456789abcdef){2,}$/u.test(normalized) ||
    /^(.{1,8})\1+$/u.test(normalized)
  );
}

function isSyntheticValue(value, category) {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  if (SYNTHETIC_MARKER_PATTERN.test(normalized)) {
    return true;
  }
  if ((category === "domain" || category === "callback") && isPlaceholderDomain(normalized)) {
    return true;
  }
  if (
    ["identity", "tenant", "subscription", "resource"].includes(category) &&
    UUID_PATTERN.test(normalized) &&
    isLowEntropyHex(normalized)
  ) {
    return true;
  }
  return category === "image" && /^[0-9a-f]{40}$/iu.test(normalized) && isLowEntropyHex(normalized);
}

function rejectSyntheticProductionValues(value, add, pathSegments = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectSyntheticProductionValues(item, add, [...pathSegments, String(index)]),
    );
    return;
  }
  if (!value || typeof value !== "object") {
    if (typeof value !== "string") {
      return;
    }
    const path = pathSegments.join(".");
    const category = syntheticValueCategory(path);
    if (isSyntheticValue(value, category)) {
      add(
        "SYNTHETIC_VALUE_PROHIBITED",
        path,
        `Production ${category} values must not contain example, test, compile, placeholder, or low-entropy fixture markers.`,
      );
    }
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    rejectSyntheticProductionValues(child, add, [...pathSegments, key]);
  }
}

function sortValidationErrors(errors) {
  return errors.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.path.localeCompare(right.path) ||
      left.message.localeCompare(right.message),
  );
}

function unwrapConfiguration(document) {
  const armConfig = document?.parameters?.config?.value;
  if (!armConfig) {
    return { config: document, parameterFeatures: null };
  }

  return {
    config: armConfig,
    parameterFeatures: {
      enableAmpls: document.parameters?.enableAmpls?.value,
      enableDiagnostics: document.parameters?.enableDiagnostics?.value,
      enableFirewall: document.parameters?.enableFirewall?.value,
      enableFoundry: document.parameters?.enableFoundry?.value,
    },
  };
}

export function getMonitoringPreflightPosture(document) {
  const { config } = unwrapConfiguration(document);
  const monitoring = config?.monitoring ?? {};
  const diagnostics = config?.diagnostics ?? {};
  const queryAccess = monitoring.queryAccess ?? {};

  return {
    applicationTraceExport: {
      disabledReason: monitoring.runtimeExporter?.disabledReason ?? "",
      exporter: monitoring.runtimeExporter?.exporter ?? "",
      runtimeTelemetryMode: monitoring.runtimeExporter?.telemetryMode ?? "",
      status: monitoring.runtimeExporter?.status ?? "unresolved",
    },
    dataCollection: {
      dataCollectionEndpointRequired:
        monitoring.dataCollection?.dataCollectionEndpointRequired ?? null,
      dataCollectionRuleRequired: monitoring.dataCollection?.dataCollectionRuleRequired ?? null,
    },
    diagnostics: {
      categories: Object.fromEntries(
        Object.keys(APPROVED_DIAGNOSTIC_CATEGORIES).map((name) => [name, diagnostics[name] ?? []]),
      ),
      enabled: config?.features?.enableDiagnostics === true,
      runtimeLogs: monitoring.runtimeLogs ?? {},
    },
    destination: {
      location: config?.resourceLocations?.monitoring ?? "",
      privateIngestion: monitoring.privateIngestion === true,
      privateQuery: monitoring.privateQuery === true,
      publicIngestion: config?.dataPlanes?.monitoringPublicIngestion ?? "unresolved",
      publicQuery: config?.dataPlanes?.monitoringPublicQuery ?? "unresolved",
      retentionInDays: monitoring.logRetentionDays ?? null,
    },
    externalControls: [
      {
        approved: queryAccess.roleAssignmentApproved === true,
        control: "Log Analytics Data Reader assignment",
        managedBy: "Bicep",
        roleDefinitionId: LOG_ANALYTICS_DATA_READER_ROLE_ID,
        scope: "LogAnalyticsWorkspace",
      },
      {
        approved: isNonEmptyString(queryAccess.approvalReference),
        control: "federated identity credential",
        managedBy: "protected-environment administration",
      },
      {
        control: "protected environment client ID",
        managedBy: "GitHub production environment",
        name: queryAccess.protectedEnvironmentVariable ?? "",
      },
      {
        control: "private AMPLS query path",
        managedBy: "approved production VNet runner and DNS",
      },
    ],
  };
}

export function validateCompileOnlyConfig(document) {
  const { config, parameterFeatures } = unwrapConfiguration(document);
  const errors = [];
  const add = (code, path, message) => {
    errors.push({ code, message, path });
  };

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [
      {
        code: "CONFIG_OBJECT_REQUIRED",
        message: "The preflight document must be a configuration object or ARM parameter document.",
        path: "$",
      },
    ];
  }

  if (config.schemaVersion !== 1) {
    add("SCHEMA_VERSION_UNSUPPORTED", "schemaVersion", "schemaVersion must be exactly 1.");
  }
  if (config.deploymentProfile !== "compile") {
    add(
      "COMPILE_ONLY_PROFILE_REQUIRED",
      "deploymentProfile",
      "Compile-only validation requires deploymentProfile=compile.",
    );
  }
  if (
    config.environmentName !== "compile" ||
    get(config, "tags.purpose") !== "compile-fixture" ||
    get(config, "nonProduction.compileOnly") !== true ||
    get(config, "nonProduction.deploymentAllowed") !== false
  ) {
    add(
      "COMPILE_ONLY_ISOLATION_REQUIRED",
      "nonProduction",
      "A compile fixture must be explicitly marked compile-only and deployment-disallowed.",
    );
  }
  if (
    get(config, "features.enableFoundry") !== false ||
    get(config, "foundry.enabled") === true ||
    parameterFeatures?.enableFoundry === true
  ) {
    add(
      "COMPILE_ONLY_FOUNDRY_PROHIBITED",
      "features.enableFoundry",
      "Compile-only fixtures cannot request Foundry.",
    );
  }

  return sortValidationErrors(errors);
}

export function validateProductionConfig(document) {
  const { config, parameterFeatures } = unwrapConfiguration(document);
  const errors = [];

  const add = (code, path, message) => {
    errors.push({ code, message, path });
  };

  const requireString = (path, code = "REQUIRED_VALUE") => {
    if (!isNonEmptyString(get(config, path))) {
      add(code, path, `${path} must be a non-empty string.`);
    }
  };

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [
      {
        code: "CONFIG_OBJECT_REQUIRED",
        message: "The preflight document must be a configuration object or ARM parameter document.",
        path: "$",
      },
    ];
  }

  if (config.schemaVersion !== 1) {
    add("SCHEMA_VERSION_UNSUPPORTED", "schemaVersion", "schemaVersion must be exactly 1.");
  }
  if (config.deploymentProfile !== "production") {
    add(
      "PRODUCTION_PROFILE_REQUIRED",
      "deploymentProfile",
      "Only a configuration explicitly marked production can pass production preflight.",
    );
  }
  if (config.dataClassification !== "Restricted") {
    add(
      "RESTRICTED_CLASSIFICATION_REQUIRED",
      "dataClassification",
      "This production foundation must fail closed under Restricted classification.",
    );
  }
  rejectSyntheticProductionValues(config, add);

  requireString("workloadName", "WORKLOAD_NAME_REQUIRED");
  requireString("environmentName", "ENVIRONMENT_NAME_REQUIRED");
  if (config.environmentName !== "production") {
    add(
      "PRODUCTION_ENVIRONMENT_REQUIRED",
      "environmentName",
      "environmentName must be production.",
    );
  }

  const primaryLocation = normalizeLocation(config.primaryLocation);
  const approvedLocations = Array.isArray(config.approvedLocations)
    ? config.approvedLocations.map(normalizeLocation).filter(Boolean)
    : [];
  const approvedLocationSet = new Set(approvedLocations);

  if (!primaryLocation) {
    add("PRIMARY_LOCATION_REQUIRED", "primaryLocation", "A primary Azure location is required.");
  }
  if (approvedLocations.length === 0) {
    add(
      "APPROVED_LOCATIONS_REQUIRED",
      "approvedLocations",
      "At least one explicitly approved Azure location is required.",
    );
  }
  if (approvedLocations.length !== approvedLocationSet.size) {
    add("APPROVED_LOCATIONS_DUPLICATE", "approvedLocations", "Approved locations must be unique.");
  }
  for (const [index, location] of approvedLocations.entries()) {
    if (/global|data[\s-]?zone/i.test(location)) {
      add(
        "NONREGIONAL_LOCATION_PROHIBITED",
        `approvedLocations.${index}`,
        "Global and DataZone values are not valid regional approvals for Restricted data.",
      );
    }
  }
  if (primaryLocation && !approvedLocationSet.has(primaryLocation)) {
    add(
      "PRIMARY_LOCATION_NOT_APPROVED",
      "primaryLocation",
      "The primary location must be present in approvedLocations.",
    );
  }

  for (const resourceName of REQUIRED_RESOURCE_LOCATIONS) {
    const path = `resourceLocations.${resourceName}`;
    const location = normalizeLocation(get(config, path));
    if (!location) {
      add("RESOURCE_LOCATION_REQUIRED", path, `${resourceName} requires an explicit location.`);
    } else if (!approvedLocationSet.has(location)) {
      add(
        "RESOURCE_LOCATION_NOT_APPROVED",
        path,
        `${resourceName} location is outside approvedLocations.`,
      );
    }
  }
  const monitoringLocation = normalizeLocation(get(config, "resourceLocations.monitoring"));
  const computeLocation = normalizeLocation(get(config, "resourceLocations.compute"));
  const networkLocation = normalizeLocation(get(config, "resourceLocations.network"));
  if (
    primaryLocation &&
    monitoringLocation &&
    (monitoringLocation !== primaryLocation ||
      computeLocation !== primaryLocation ||
      networkLocation !== primaryLocation)
  ) {
    add(
      "MONITORING_LOCATION_MISMATCH",
      "resourceLocations",
      "Container Apps, its VNet/AMPLS private endpoint, and its Log Analytics/Application Insights destination must use the primary approved region.",
    );
  }

  for (const name of REQUIRED_NAMES) {
    requireString(`names.${name}`, "RESOURCE_NAME_REQUIRED");
  }
  if (
    isNonEmptyString(get(config, "names.appIdentity")) &&
    get(config, "names.appIdentity").toLowerCase() ===
      (get(config, "names.migrationIdentity") ?? "").toLowerCase()
  ) {
    add(
      "MANAGED_IDENTITIES_NOT_DISTINCT",
      "names.migrationIdentity",
      "Application and migration user-assigned identities must be distinct resources.",
    );
  }
  if (get(config, "names.firewallSubnet") !== "AzureFirewallSubnet") {
    add(
      "FIREWALL_SUBNET_NAME_INVALID",
      "names.firewallSubnet",
      "The reserved Azure Firewall subnet must be named AzureFirewallSubnet.",
    );
  }
  if (!/^[a-z0-9]{5,50}$/.test(get(config, "names.containerRegistry") ?? "")) {
    add(
      "ACR_NAME_INVALID",
      "names.containerRegistry",
      "The registry name must use 5-50 lowercase alphanumeric characters.",
    );
  }

  const tags = config.tags;
  if (!tags || typeof tags !== "object" || Array.isArray(tags) || Object.keys(tags).length === 0) {
    add("TAGS_REQUIRED", "tags", "A non-empty deployment tag map is required.");
  }
  for (const key of ["dataClassification", "managedBy", "purpose"]) {
    requireString(`tags.${key}`, "REQUIRED_TAG_MISSING");
  }
  if (get(config, "tags.dataClassification") !== config.dataClassification) {
    add(
      "CLASSIFICATION_TAG_MISMATCH",
      "tags.dataClassification",
      "The classification tag must match dataClassification.",
    );
  }

  const vnetPrefixes = Array.isArray(get(config, "network.vnetAddressPrefixes"))
    ? get(config, "network.vnetAddressPrefixes")
    : [];
  if (vnetPrefixes.length === 0) {
    add(
      "VNET_ADDRESS_SPACE_REQUIRED",
      "network.vnetAddressPrefixes",
      "At least one VNet address prefix is required.",
    );
  }
  const parsedVnetPrefixes = vnetPrefixes
    .map((prefix, index) => {
      const parsed = parseIpv4Cidr(prefix);
      if (!parsed) {
        add(
          "CIDR_INVALID",
          `network.vnetAddressPrefixes.${index}`,
          "VNet address prefixes must be canonical IPv4 CIDRs.",
        );
      }
      return parsed;
    })
    .filter(Boolean);
  for (let leftIndex = 0; leftIndex < parsedVnetPrefixes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < parsedVnetPrefixes.length; rightIndex += 1) {
      const left = parsedVnetPrefixes[leftIndex];
      const right = parsedVnetPrefixes[rightIndex];
      if (left && right && rangesOverlap(left, right)) {
        add(
          "VNET_ADDRESS_SPACES_OVERLAP",
          `network.vnetAddressPrefixes.${leftIndex},network.vnetAddressPrefixes.${rightIndex}`,
          "VNet address prefixes must not overlap.",
        );
      }
    }
  }

  const subnetEntries = [
    ["applicationGateway", "network.subnets.applicationGateway"],
    ["containerApps", "network.subnets.containerApps"],
    ["privateEndpoints", "network.subnets.privateEndpoints"],
    ["firewall", "network.subnets.firewall"],
  ].map(([name, path]) => {
    const parsed = parseIpv4Cidr(get(config, path));
    if (!parsed) {
      add("CIDR_INVALID", path, `${name} must be a canonical IPv4 CIDR.`);
    } else if (!parsedVnetPrefixes.some((vnet) => rangeContains(vnet, parsed))) {
      add("SUBNET_OUTSIDE_VNET", path, `${name} must fit inside a VNet address prefix.`);
    }
    return { name, parsed, path };
  });
  const applicationGatewayRange = subnetEntries.find(
    (entry) => entry.name === "applicationGateway",
  )?.parsed;
  if (applicationGatewayRange && applicationGatewayRange.prefix > 24) {
    add(
      "APPLICATION_GATEWAY_SUBNET_TOO_SMALL",
      "network.subnets.applicationGateway",
      "Reserve at least a /24 Application Gateway subnet.",
    );
  }
  const containerAppsRange = subnetEntries.find((entry) => entry.name === "containerApps")?.parsed;
  if (containerAppsRange && containerAppsRange.prefix > 23) {
    add(
      "CONTAINER_APPS_SUBNET_TOO_SMALL",
      "network.subnets.containerApps",
      "The workload-profile Container Apps infrastructure subnet must be /23 or larger.",
    );
  }
  const firewallRange = subnetEntries.find((entry) => entry.name === "firewall")?.parsed;
  if (firewallRange && firewallRange.prefix > 26) {
    add(
      "FIREWALL_SUBNET_TOO_SMALL",
      "network.subnets.firewall",
      "Reserve at least a /26 Azure Firewall subnet.",
    );
  }

  for (let leftIndex = 0; leftIndex < subnetEntries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < subnetEntries.length; rightIndex += 1) {
      const left = subnetEntries[leftIndex];
      const right = subnetEntries[rightIndex];
      if (left?.parsed && right?.parsed && rangesOverlap(left.parsed, right.parsed)) {
        add(
          "SUBNETS_OVERLAP",
          `${left.path},${right.path}`,
          `${left.name} and ${right.name} must not overlap.`,
        );
      }
    }
  }

  const platformRanges = [
    ["dockerBridgeCidr", "containerApps.network.dockerBridgeCidr"],
    ["platformReservedCidr", "containerApps.network.platformReservedCidr"],
  ].map(([name, path]) => {
    const parsed = parseIpv4Cidr(get(config, path));
    if (!parsed) {
      add("CIDR_INVALID", path, `${name} must be a canonical IPv4 CIDR.`);
    }
    return { name, parsed, path };
  });
  const platformReservedRange = platformRanges.find(
    (entry) => entry.name === "platformReservedCidr",
  )?.parsed;
  const platformDnsIp = parseIpv4Cidr(
    `${get(config, "containerApps.network.platformReservedDnsIp") ?? ""}/32`,
  );
  if (
    !platformDnsIp ||
    !platformReservedRange ||
    !rangeContains(platformReservedRange, platformDnsIp) ||
    platformDnsIp.start === platformReservedRange.start ||
    platformDnsIp.start === platformReservedRange.end
  ) {
    add(
      "CONTAINER_APPS_RESERVED_DNS_IP_INVALID",
      "containerApps.network.platformReservedDnsIp",
      "The reserved DNS IP must be a usable address inside platformReservedCidr.",
    );
  }
  for (const platformRange of platformRanges) {
    if (
      platformRange.parsed &&
      parsedVnetPrefixes.some((vnetPrefix) => rangesOverlap(vnetPrefix, platformRange.parsed))
    ) {
      add(
        "PLATFORM_NETWORK_RANGES_OVERLAP",
        platformRange.path,
        `${platformRange.name} must not overlap a VNet address prefix.`,
      );
    }
  }
  const allNetworkRanges = [...subnetEntries, ...platformRanges].filter((entry) => entry.parsed);
  for (let leftIndex = 0; leftIndex < allNetworkRanges.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < allNetworkRanges.length; rightIndex += 1) {
      const left = allNetworkRanges[leftIndex];
      const right = allNetworkRanges[rightIndex];
      if (left && right && rangesOverlap(left.parsed, right.parsed)) {
        const isTwoSubnets = subnetEntries.includes(left) && subnetEntries.includes(right);
        if (!isTwoSubnets) {
          add(
            "PLATFORM_NETWORK_RANGES_OVERLAP",
            `${left.path},${right.path}`,
            `${left.name} and ${right.name} must not overlap.`,
          );
        }
      }
    }
  }

  for (const [path, requiredZones] of Object.entries(REQUIRED_PRIVATE_DNS_ZONES)) {
    const configuredZones = get(config, path);
    const normalizedZones = Array.isArray(configuredZones)
      ? configuredZones.map((zone) => (typeof zone === "string" ? zone.trim().toLowerCase() : ""))
      : [];
    for (const requiredZone of requiredZones) {
      if (!normalizedZones.includes(requiredZone)) {
        add(
          "PRIVATE_DNS_ZONE_REQUIRED",
          path,
          `${path} must include ${requiredZone} for private endpoint resolution.`,
        );
      }
    }
    normalizedZones.forEach((zone, index) => {
      if (!HOST_PATTERN.test(zone)) {
        add(
          "PRIVATE_DNS_ZONE_INVALID",
          `${path}.${index}`,
          "Private DNS zones must be syntactically valid DNS names.",
        );
      }
    });
    if (new Set(normalizedZones).size !== normalizedZones.length) {
      add("PRIVATE_DNS_ZONE_DUPLICATE", path, "Private DNS zones must be unique.");
    }
  }

  if (get(config, "egress.mode") !== "azureFirewall") {
    add(
      "EGRESS_MODE_UNAPPROVED",
      "egress.mode",
      "Restricted production requires the implemented azureFirewall outbound-control mode.",
    );
  }
  if (!isTrue(get(config, "egress.outboundControlApproved"))) {
    add(
      "EGRESS_APPROVAL_REQUIRED",
      "egress.outboundControlApproved",
      "Outbound control requires explicit approval.",
    );
  }
  if (!isTrue(get(config, "features.enableFirewall"))) {
    add(
      "FIREWALL_REQUIRED_FOR_SELECTED_EGRESS",
      "features.enableFirewall",
      "The production egress mode requires Azure Firewall to be enabled.",
    );
  }
  const firewallSkuTier = get(config, "egress.firewall.skuTier");
  requireString("egress.firewall.skuTier", "FIREWALL_SKU_REQUIRED");
  if (isNonEmptyString(firewallSkuTier) && !["Standard", "Premium"].includes(firewallSkuTier)) {
    add(
      "FIREWALL_SKU_INVALID",
      "egress.firewall.skuTier",
      "Restricted production requires Azure Firewall Standard or Premium.",
    );
  }
  if (!hasDistinctZones(get(config, "egress.firewall.zones"))) {
    add(
      "FIREWALL_ZONES_REQUIRED",
      "egress.firewall.zones",
      "Production Azure Firewall requires at least two distinct availability zones.",
    );
  }
  const allowedFqdns = get(config, "egress.firewall.allowedFqdns");
  if (!Array.isArray(allowedFqdns) || allowedFqdns.length === 0) {
    add(
      "EGRESS_ALLOWLIST_REQUIRED",
      "egress.firewall.allowedFqdns",
      "Firewall mode requires an explicit non-empty FQDN allowlist.",
    );
  } else {
    allowedFqdns.forEach((fqdn, index) => {
      if (!isFirewallFqdn(fqdn)) {
        add(
          "EGRESS_ALLOWLIST_INVALID",
          `egress.firewall.allowedFqdns.${index}`,
          "Firewall allowlist entries must be FQDNs or leading-wildcard FQDNs.",
        );
      }
    });
    const normalizedFqdns = allowedFqdns.map((fqdn) =>
      typeof fqdn === "string" ? fqdn.trim().toLowerCase() : "",
    );
    if (new Set(normalizedFqdns).size !== normalizedFqdns.length) {
      add(
        "EGRESS_ALLOWLIST_DUPLICATE",
        "egress.firewall.allowedFqdns",
        "Firewall allowlist entries must be unique.",
      );
    }
  }

  if (
    get(config, "applicationGateway.skuName") !== "WAF_v2" ||
    get(config, "applicationGateway.skuTier") !== "WAF_v2"
  ) {
    add(
      "APPLICATION_GATEWAY_WAF_SKU_REQUIRED",
      "applicationGateway",
      "The regional ingress SKU name and tier must both be WAF_v2.",
    );
  }
  requireString("applicationGateway.sslPolicyName", "APPLICATION_GATEWAY_TLS_POLICY_REQUIRED");
  if ((get(config, "applicationGateway.autoscale.minimumCapacity") ?? 0) < 2) {
    add(
      "APPLICATION_GATEWAY_HA_REQUIRED",
      "applicationGateway.autoscale.minimumCapacity",
      "Production Application Gateway must keep at least two instances.",
    );
  }
  if (!hasDistinctZones(get(config, "applicationGateway.zones"))) {
    add(
      "APPLICATION_GATEWAY_ZONES_REQUIRED",
      "applicationGateway.zones",
      "Production Application Gateway requires at least two explicitly selected zones.",
    );
  }
  requireString("containerApps.workloadProfile.name", "CONTAINER_APPS_SKU_REQUIRED");
  requireString("containerApps.workloadProfile.type", "CONTAINER_APPS_SKU_REQUIRED");
  if (!isTrue(get(config, "containerApps.zoneRedundant"))) {
    add(
      "CONTAINER_APPS_ZONE_REDUNDANCY_REQUIRED",
      "containerApps.zoneRedundant",
      "Production Container Apps environment must explicitly enable zone redundancy.",
    );
  }
  if ((get(config, "containerApps.app.scale.minimumReplicas") ?? 0) < 2) {
    add(
      "CONTAINER_APP_HA_REQUIRED",
      "containerApps.app.scale.minimumReplicas",
      "Production web scale must keep at least two replicas.",
    );
  }
  if (get(config, "containerApps.app.targetPort") !== 3000) {
    add(
      "CONTAINER_APP_TARGET_PORT_INVALID",
      "containerApps.app.targetPort",
      "The Container App target port must match the standalone image port 3000.",
    );
  }
  if (get(config, "containerRegistry.sku") !== "Premium") {
    add(
      "ACR_PREMIUM_REQUIRED",
      "containerRegistry.sku",
      "Private Link requires Azure Container Registry Premium.",
    );
  }
  if (get(config, "containerRegistry.zoneRedundancy") !== "Enabled") {
    add(
      "ACR_ZONE_REDUNDANCY_REQUIRED",
      "containerRegistry.zoneRedundancy",
      "Production ACR must explicitly enable zone redundancy.",
    );
  }
  const keyVaultSku = get(config, "keyVault.sku");
  requireString("keyVault.sku", "KEY_VAULT_SKU_REQUIRED");
  if (isNonEmptyString(keyVaultSku) && !["standard", "premium"].includes(keyVaultSku)) {
    add("KEY_VAULT_SKU_INVALID", "keyVault.sku", "Key Vault SKU must be standard or premium.");
  }
  requireString("postgres.skuName", "POSTGRES_SKU_REQUIRED");
  const postgresSkuTier = get(config, "postgres.skuTier");
  requireString("postgres.skuTier", "POSTGRES_SKU_REQUIRED");
  if (
    isNonEmptyString(postgresSkuTier) &&
    !["GeneralPurpose", "MemoryOptimized"].includes(postgresSkuTier)
  ) {
    add(
      "POSTGRES_SKU_TIER_INVALID",
      "postgres.skuTier",
      "HA production PostgreSQL requires GeneralPurpose or MemoryOptimized.",
    );
  }
  if (get(config, "postgres.version") !== "18") {
    add("POSTGRES_VERSION_INVALID", "postgres.version", "The pinned PostgreSQL major is 18.");
  }
  if (!["SameZone", "ZoneRedundant"].includes(get(config, "postgres.highAvailabilityMode"))) {
    add(
      "POSTGRES_HA_REQUIRED",
      "postgres.highAvailabilityMode",
      "Production PostgreSQL requires an explicitly selected HA mode.",
    );
  }
  if (
    get(config, "postgres.highAvailabilityMode") === "ZoneRedundant" &&
    !isNonEmptyString(get(config, "postgres.standbyAvailabilityZone"))
  ) {
    add(
      "POSTGRES_STANDBY_ZONE_REQUIRED",
      "postgres.standbyAvailabilityZone",
      "Zone-redundant PostgreSQL requires an explicit standby availability zone.",
    );
  }
  if ((get(config, "postgres.backupRetentionDays") ?? 0) < 7) {
    add(
      "POSTGRES_BACKUP_RETENTION_INVALID",
      "postgres.backupRetentionDays",
      "Production backup retention must be at least seven days.",
    );
  }
  requireString("postgres.appPrincipalName", "POSTGRES_APP_IDENTITY_REQUIRED");
  requireString("postgres.migrationPrincipalName", "POSTGRES_MIGRATION_IDENTITY_REQUIRED");
  if (
    isNonEmptyString(get(config, "postgres.appPrincipalName")) &&
    get(config, "postgres.appPrincipalName").toLowerCase() ===
      (get(config, "postgres.migrationPrincipalName") ?? "").toLowerCase()
  ) {
    add(
      "POSTGRES_PRINCIPALS_NOT_DISTINCT",
      "postgres.migrationPrincipalName",
      "Application and migration PostgreSQL principals must be distinct.",
    );
  }
  if (!UUID_PATTERN.test(get(config, "postgres.entraAdministratorObjectId") ?? "")) {
    add(
      "POSTGRES_ENTRA_ADMIN_OBJECT_ID_INVALID",
      "postgres.entraAdministratorObjectId",
      "The PostgreSQL Entra administrator object ID must be a concrete UUID.",
    );
  }
  requireString(
    "postgres.entraAdministratorPrincipalName",
    "POSTGRES_ENTRA_ADMIN_PRINCIPAL_REQUIRED",
  );
  if (
    !["Group", "ServicePrincipal", "User"].includes(
      get(config, "postgres.entraAdministratorPrincipalType"),
    )
  ) {
    add(
      "POSTGRES_ENTRA_ADMIN_TYPE_INVALID",
      "postgres.entraAdministratorPrincipalType",
      "The PostgreSQL Entra administrator principal type must be explicit.",
    );
  }
  requireString("postgres.databaseCharset", "POSTGRES_DATABASE_CHARSET_REQUIRED");
  requireString("postgres.databaseCollation", "POSTGRES_DATABASE_COLLATION_REQUIRED");
  if (!["TLSv1.2", "TLSv1.3"].includes(get(config, "postgres.minimumTlsVersion"))) {
    add(
      "POSTGRES_TLS_VERSION_INVALID",
      "postgres.minimumTlsVersion",
      "PostgreSQL must use an explicit supported TLS minimum version.",
    );
  }

  const geoRedundantBackup = get(config, "postgres.geoRedundantBackup");
  if (!["Enabled", "Disabled"].includes(geoRedundantBackup)) {
    add(
      "POSTGRES_GEO_BACKUP_SETTING_INVALID",
      "postgres.geoRedundantBackup",
      "Geo-redundant backup must be explicitly Enabled or Disabled.",
    );
  }
  if (geoRedundantBackup === "Enabled") {
    const secondaryLocation = normalizeLocation(get(config, "postgres.backupSecondaryLocation"));
    if (!secondaryLocation || !approvedLocationSet.has(secondaryLocation)) {
      add(
        "GEO_BACKUP_LOCATION_NOT_APPROVED",
        "postgres.backupSecondaryLocation",
        "Geo-redundant backup requires an explicitly approved secondary location.",
      );
    }
    if (!isTrue(get(config, "postgres.geoBackupApproved"))) {
      add(
        "GEO_BACKUP_APPROVAL_REQUIRED",
        "postgres.geoBackupApproved",
        "Geo-redundant backup requires explicit approval.",
      );
    }
  }

  const configuredReplicas = get(config, "postgres.replicas");
  if (!Array.isArray(configuredReplicas)) {
    add(
      "POSTGRES_REPLICA_LIST_INVALID",
      "postgres.replicas",
      "PostgreSQL replicas must be an explicit array.",
    );
  }
  const replicas = Array.isArray(configuredReplicas) ? configuredReplicas : [];
  replicas.forEach((replica, index) => {
    const location = normalizeLocation(replica?.location);
    if (!location || !approvedLocationSet.has(location)) {
      add(
        "REPLICA_LOCATION_NOT_APPROVED",
        `postgres.replicas.${index}.location`,
        "Every replica must use an approved location.",
      );
    }
    if (replica?.approved !== true) {
      add(
        "REPLICA_APPROVAL_REQUIRED",
        `postgres.replicas.${index}.approved`,
        "Every replica requires explicit approval.",
      );
    }
  });

  const logAnalyticsSku = get(config, "monitoring.logAnalyticsSku");
  requireString("monitoring.logAnalyticsSku", "MONITORING_SKU_REQUIRED");
  if (isNonEmptyString(logAnalyticsSku) && logAnalyticsSku !== "PerGB2018") {
    add(
      "MONITORING_SKU_INVALID",
      "monitoring.logAnalyticsSku",
      "The production workspace must use the reviewed PerGB2018 SKU.",
    );
  }
  const logRetentionDays = get(config, "monitoring.logRetentionDays");
  if (!Number.isInteger(logRetentionDays) || logRetentionDays < 30 || logRetentionDays > 730) {
    add(
      "LOG_RETENTION_INVALID",
      "monitoring.logRetentionDays",
      "Production Log Analytics retention must be an explicit integer from 30 through 730 days.",
    );
  }
  const applicationInsightsRetentionDays = get(
    config,
    "monitoring.applicationInsightsRetentionDays",
  );
  if (!APPLICATION_INSIGHTS_RETENTION_VALUES.has(applicationInsightsRetentionDays)) {
    add(
      "APPLICATION_INSIGHTS_RETENTION_INVALID",
      "monitoring.applicationInsightsRetentionDays",
      "Application Insights retention must use an explicit supported value from 30 through 730 days.",
    );
  }
  if (
    Number.isInteger(logRetentionDays) &&
    APPLICATION_INSIGHTS_RETENTION_VALUES.has(applicationInsightsRetentionDays) &&
    applicationInsightsRetentionDays !== logRetentionDays
  ) {
    add(
      "MONITORING_RETENTION_MISMATCH",
      "monitoring.applicationInsightsRetentionDays",
      "Workspace-based Application Insights and Log Analytics must declare the same approved retention.",
    );
  }
  const dailyQuotaGb = get(config, "monitoring.dailyQuotaGb");
  if (typeof dailyQuotaGb !== "number" || !Number.isFinite(dailyQuotaGb) || dailyQuotaGb <= 0) {
    add(
      "MONITORING_DAILY_QUOTA_INVALID",
      "monitoring.dailyQuotaGb",
      "The regional workspace requires an explicit positive daily ingestion cap.",
    );
  }
  if (
    !isTrue(get(config, "monitoring.regionalDestinationApproved")) ||
    !isNonEmptyString(get(config, "monitoring.regionalDestinationApprovalReference"))
  ) {
    add(
      "MONITORING_REGIONAL_DESTINATION_APPROVAL_REQUIRED",
      "monitoring.regionalDestinationApproved",
      "The Log Analytics/Application Insights region requires a reviewed approval reference.",
    );
  }
  if (
    !isTrue(get(config, "monitoring.retentionApproved")) ||
    !isNonEmptyString(get(config, "monitoring.retentionApprovalReference"))
  ) {
    add(
      "MONITORING_RETENTION_APPROVAL_REQUIRED",
      "monitoring.retentionApproved",
      "Monitoring retention requires a reviewed approval reference.",
    );
  }
  if (!isTrue(get(config, "features.enableAmpls"))) {
    add(
      "AMPLS_REQUIRED",
      "features.enableAmpls",
      "Production telemetry requires AMPLS unless a separately implemented exception exists.",
    );
  }
  if (
    !isTrue(get(config, "monitoring.privateIngestion")) ||
    !isTrue(get(config, "monitoring.privateQuery"))
  ) {
    add(
      "PRIVATE_MONITORING_REQUIRED",
      "monitoring",
      "Monitoring ingestion and query must both be private.",
    );
  }
  if (get(config, "monitoring.amplsLocation") !== "global") {
    add(
      "AMPLS_LOCATION_INVALID",
      "monitoring.amplsLocation",
      "The GA AMPLS resource must use its explicit global control-plane location.",
    );
  }
  if (
    !isTrue(get(config, "monitoring.amplsNonRegionalControlPlaneApproved")) ||
    !isNonEmptyString(get(config, "monitoring.amplsNonRegionalApprovalReference"))
  ) {
    add(
      "AMPLS_NONREGIONAL_APPROVAL_REQUIRED",
      "monitoring.amplsNonRegionalControlPlaneApproved",
      "The AMPLS global control-plane location requires an explicit non-data-plane approval and reference.",
    );
  }
  if (
    !isTrue(get(config, "monitoring.runtimeLogs.enabled")) ||
    get(config, "monitoring.runtimeLogs.format") !== "pii-safe-json-stdout" ||
    get(config, "monitoring.runtimeLogs.destination") !==
      "regional-log-analytics-via-azure-monitor-diagnostics"
  ) {
    add(
      "RUNTIME_STDOUT_POSTURE_INVALID",
      "monitoring.runtimeLogs",
      "Production requires PII-safe JSON stdout routed through Azure Monitor diagnostics to regional Log Analytics.",
    );
  }
  if (
    get(config, "monitoring.runtimeExporter.status") !== "scaffolded-disabled" ||
    get(config, "monitoring.runtimeExporter.telemetryMode") !== "disabled" ||
    get(config, "monitoring.runtimeExporter.exporter") !== "none"
  ) {
    add(
      "RUNTIME_EXPORTER_MUST_REMAIN_DISABLED",
      "monitoring.runtimeExporter",
      "Application trace export must remain scaffolded-disabled with TELEMETRY_MODE=disabled and no exporter.",
    );
  }
  if (
    get(config, "monitoring.runtimeExporter.disabledReason") !== RUNTIME_EXPORTER_DISABLED_REASON
  ) {
    add(
      "RUNTIME_EXPORTER_DISABLED_REASON_INVALID",
      "monitoring.runtimeExporter.disabledReason",
      "The disabled exporter rationale must record the reviewed stable-package and loader incompatibility exactly.",
    );
  }
  if (
    !isTrue(get(config, "monitoring.runtimeExporter.postureApproved")) ||
    !isNonEmptyString(get(config, "monitoring.runtimeExporter.approvalReference"))
  ) {
    add(
      "RUNTIME_TELEMETRY_POSTURE_APPROVAL_REQUIRED",
      "monitoring.runtimeExporter.postureApproved",
      "Production requires explicit review of the disabled-exporter and JSON-stdout telemetry posture.",
    );
  }
  if (
    get(config, "monitoring.dataCollection.dataCollectionEndpointRequired") !== false ||
    get(config, "monitoring.dataCollection.dataCollectionRuleRequired") !== false
  ) {
    add(
      "MONITORING_DATA_COLLECTION_SURFACE_INVALID",
      "monitoring.dataCollection",
      "DCE and DCR must remain explicitly not required while AMA, Logs Ingestion API, and application trace export are absent.",
    );
  }
  if (
    !isTrue(get(config, "monitoring.dataCollection.decisionApproved")) ||
    !isNonEmptyString(get(config, "monitoring.dataCollection.approvalReference"))
  ) {
    add(
      "MONITORING_DATA_COLLECTION_DECISION_APPROVAL_REQUIRED",
      "monitoring.dataCollection.decisionApproved",
      "The current no-DCE/no-DCR decision requires an explicit review reference.",
    );
  }
  const queryIdentityType = get(config, "monitoring.queryAccess.identityType");
  if (queryIdentityType !== "UserAssignedManagedIdentity") {
    add(
      "MONITORING_QUERY_IDENTITY_INVALID",
      "monitoring.queryAccess.identityType",
      "Rollout log queries require the reviewed user-assigned managed identity posture.",
    );
  }
  for (const field of ["principalId", "clientId"]) {
    if (!UUID_PATTERN.test(get(config, `monitoring.queryAccess.${field}`) ?? "")) {
      add(
        "MONITORING_QUERY_IDENTITY_INVALID",
        `monitoring.queryAccess.${field}`,
        `Monitoring query ${field} must be a concrete UUID.`,
      );
    }
  }
  if (
    UUID_PATTERN.test(get(config, "monitoring.queryAccess.principalId") ?? "") &&
    get(config, "monitoring.queryAccess.principalId").toLowerCase() ===
      (get(config, "monitoring.queryAccess.clientId") ?? "").toLowerCase()
  ) {
    add(
      "MONITORING_QUERY_IDENTITY_NOT_DISTINCT",
      "monitoring.queryAccess",
      "The managed identity principal ID and client ID must be distinct identifiers.",
    );
  }
  if (
    get(config, "monitoring.queryAccess.roleDefinitionId") !== LOG_ANALYTICS_DATA_READER_ROLE_ID ||
    get(config, "monitoring.queryAccess.roleScope") !== "LogAnalyticsWorkspace"
  ) {
    add(
      "MONITORING_QUERY_ROLE_INVALID",
      "monitoring.queryAccess",
      "The query identity must receive only Log Analytics Data Reader at the workspace scope.",
    );
  }
  if (
    !isTrue(get(config, "monitoring.queryAccess.roleAssignmentApproved")) ||
    !isNonEmptyString(get(config, "monitoring.queryAccess.approvalReference"))
  ) {
    add(
      "MONITORING_QUERY_ROLE_APPROVAL_REQUIRED",
      "monitoring.queryAccess.roleAssignmentApproved",
      "The workspace-scoped monitoring query role assignment requires explicit approval.",
    );
  }
  if (
    get(config, "monitoring.queryAccess.federatedCredentialManagedExternally") !== true ||
    get(config, "monitoring.queryAccess.protectedEnvironmentVariable") !==
      "AZURE_MIGRATION_RUNTIME_CLIENT_ID"
  ) {
    add(
      "MONITORING_QUERY_EXTERNAL_CONTROL_INVALID",
      "monitoring.queryAccess",
      "Preflight must record the external federated credential and protected workflow client-ID binding.",
    );
  }
  if (!isTrue(get(config, "features.enableDiagnostics"))) {
    add(
      "DIAGNOSTICS_REQUIRED",
      "features.enableDiagnostics",
      "Production requires diagnostic settings to be enabled.",
    );
  }
  if (!isTrue(get(config, "diagnostics.categoriesVerified"))) {
    add(
      "DIAGNOSTIC_CATEGORIES_UNVERIFIED",
      "diagnostics.categoriesVerified",
      "Stable diagnostic category names must be verified read-only in the target subscription.",
    );
  }
  if (!isNonEmptyString(get(config, "diagnostics.approvalReference"))) {
    add(
      "DIAGNOSTIC_APPROVAL_REFERENCE_REQUIRED",
      "diagnostics.approvalReference",
      "The exact diagnostic category schema review requires an approval reference.",
    );
  }
  for (const [categorySet, approvedCategories] of Object.entries(APPROVED_DIAGNOSTIC_CATEGORIES)) {
    if (
      !arraysContainSameUniqueStrings(get(config, `diagnostics.${categorySet}`), approvedCategories)
    ) {
      add(
        "DIAGNOSTIC_CATEGORY_ALLOWLIST_MISMATCH",
        `diagnostics.${categorySet}`,
        `${categorySet} must contain only the exact reviewed diagnostic category allowlist.`,
      );
    }
  }

  const imageRepository = get(config, "image.repository");
  requireString("image.repository", "IMAGE_REPOSITORY_REQUIRED");
  if (isNonEmptyString(imageRepository) && !OCI_REPOSITORY_PATTERN.test(imageRepository)) {
    add(
      "IMAGE_REPOSITORY_INVALID",
      "image.repository",
      "The image repository must be a safe lowercase OCI repository path.",
    );
  }
  const imageTag = get(config, "image.tag");
  requireString("image.tag", "IMAGE_TAG_REQUIRED");
  if (isNonEmptyString(imageTag) && !IMMUTABLE_IMAGE_TAG_PATTERN.test(imageTag)) {
    add(
      "IMAGE_TAG_NOT_IMMUTABLE",
      "image.tag",
      "The production image tag must be a lowercase full commit SHA.",
    );
  }
  const migrationCommand = get(config, "image.migrationCommand");
  if (!Array.isArray(migrationCommand) || migrationCommand.length === 0) {
    add(
      "MIGRATION_COMMAND_REQUIRED",
      "image.migrationCommand",
      "The private migration job requires a dedicated command.",
    );
  } else if (!arraysEqual(migrationCommand, PRODUCTION_MIGRATION_COMMAND)) {
    add(
      "MIGRATION_COMMAND_INVALID",
      "image.migrationCommand",
      "The migration command must invoke the image's production migration entrypoint.",
    );
  }
  if (!arraysEqual(get(config, "image.migrationArguments"), PRODUCTION_MIGRATION_ARGUMENTS)) {
    add(
      "MIGRATION_ARGUMENTS_INVALID",
      "image.migrationArguments",
      "The migration arguments must select the bundled production managed-identity migrator.",
    );
  }

  const publicHost = (get(config, "dns.publicHost") ?? "").toLowerCase();
  const callbackHost = (get(config, "dns.callbackHost") ?? "").toLowerCase();
  if (!HOST_PATTERN.test(publicHost)) {
    add(
      "PUBLIC_HOST_INVALID",
      "dns.publicHost",
      "A syntactically valid public DNS host is required.",
    );
  }
  if (!HOST_PATTERN.test(callbackHost)) {
    add(
      "CALLBACK_HOST_INVALID",
      "dns.callbackHost",
      "A syntactically valid callback host is required.",
    );
  } else if (callbackHost !== publicHost) {
    add(
      "CALLBACK_HOST_MISMATCH",
      "dns.callbackHost",
      "The callback host must match the Application Gateway public host.",
    );
  }
  if (!isTrue(get(config, "dns.domainOwnershipApproved"))) {
    add(
      "DNS_OWNERSHIP_APPROVAL_REQUIRED",
      "dns.domainOwnershipApproved",
      "DNS ownership must be explicitly approved.",
    );
  }

  const tlsCertificateUri = get(config, "tls.certificateVersionedSecretUri");
  if (!isHttpsUrl(tlsCertificateUri) || !/\/secrets\/[^/]+\/[a-z0-9]+$/i.test(tlsCertificateUri)) {
    add(
      "TLS_CERTIFICATE_VERSION_REQUIRED",
      "tls.certificateVersionedSecretUri",
      "Application Gateway requires a versioned HTTPS Key Vault certificate secret URI.",
    );
  }
  const expectedVaultHost = `${get(config, "names.keyVault") ?? ""}.vault.azure.net`.toLowerCase();
  if (isHttpsUrl(tlsCertificateUri) && urlHost(tlsCertificateUri) !== expectedVaultHost) {
    add(
      "TLS_CERTIFICATE_VAULT_MISMATCH",
      "tls.certificateVersionedSecretUri",
      "The TLS certificate must be stored in the RBAC-protected deployment Key Vault.",
    );
  }
  requireString("tls.certificateName", "TLS_CERTIFICATE_NAME_REQUIRED");
  if (!["TLS1_2", "TLS1_3"].includes(get(config, "tls.minimumVersion"))) {
    add(
      "TLS_MINIMUM_VERSION_REQUIRED",
      "tls.minimumVersion",
      "An approved TLS minimum version is required.",
    );
  }
  if (!isTrue(get(config, "tls.ownershipApproved"))) {
    add(
      "TLS_OWNERSHIP_APPROVAL_REQUIRED",
      "tls.ownershipApproved",
      "Certificate ownership and lifecycle must be explicitly approved.",
    );
  }

  if (!["microsoftEntra", "customOidc"].includes(get(config, "auth.provider"))) {
    add(
      "AUTH_PROVIDER_INVALID",
      "auth.provider",
      "Auth provider must be microsoftEntra or customOidc.",
    );
  }
  requireString("auth.issuer", "AUTH_ISSUER_REQUIRED");
  if (!isHttpsUrl(get(config, "auth.issuer"))) {
    add("AUTH_ISSUER_INVALID", "auth.issuer", "The auth issuer must be an HTTPS URL.");
  }
  requireString("auth.audience", "AUTH_AUDIENCE_REQUIRED");
  if (!UUID_PATTERN.test(get(config, "auth.tenantId") ?? "")) {
    add("AUTH_TENANT_INVALID", "auth.tenantId", "A concrete tenant UUID is required.");
  }
  if (!UUID_PATTERN.test(get(config, "auth.clientId") ?? "")) {
    add("AUTH_CLIENT_INVALID", "auth.clientId", "A concrete client UUID is required.");
  }
  if (
    !isHttpsUrl(get(config, "auth.clientSecretKeyVaultUrl")) ||
    !/\/secrets\/[^/]+\/[a-z0-9]+$/i.test(get(config, "auth.clientSecretKeyVaultUrl") ?? "")
  ) {
    add(
      "AUTH_SECRET_REFERENCE_INVALID",
      "auth.clientSecretKeyVaultUrl",
      "OIDC client credentials must use a versioned Key Vault secret reference.",
    );
  } else if (urlHost(get(config, "auth.clientSecretKeyVaultUrl")) !== expectedVaultHost) {
    add(
      "AUTH_SECRET_VAULT_MISMATCH",
      "auth.clientSecretKeyVaultUrl",
      "The OIDC client credential must be stored in the RBAC-protected deployment Key Vault.",
    );
  }
  const callbackUrls = get(config, "auth.callbackUrls");
  if (!Array.isArray(callbackUrls) || callbackUrls.length === 0) {
    add(
      "AUTH_CALLBACK_REQUIRED",
      "auth.callbackUrls",
      "At least one explicit callback or allowed external redirect URL is required.",
    );
  }
  (Array.isArray(callbackUrls) ? callbackUrls : []).forEach((callbackUrl, index) => {
    if (!isHttpsUrl(callbackUrl) || urlHost(callbackUrl) !== publicHost) {
      add(
        "AUTH_CALLBACK_INVALID",
        `auth.callbackUrls.${index}`,
        "Callbacks and allowed external redirects must use HTTPS and the approved public host.",
      );
    }
  });
  if (!AUTH_DURATION_PATTERN.test(get(config, "auth.cookieExpiration") ?? "")) {
    add(
      "AUTH_COOKIE_EXPIRATION_INVALID",
      "auth.cookieExpiration",
      "Container Apps cookie expiration must use an explicit HH:MM:SS duration.",
    );
  }
  if (!AUTH_DURATION_PATTERN.test(get(config, "auth.nonceExpiration") ?? "")) {
    add(
      "AUTH_NONCE_EXPIRATION_INVALID",
      "auth.nonceExpiration",
      "Container Apps nonce expiration must use an explicit HH:MM:SS duration.",
    );
  }
  if (get(config, "auth.provider") === "microsoftEntra") {
    const loginParameters = get(config, "auth.loginParameters");
    if (!Array.isArray(loginParameters)) {
      add(
        "AUTH_LOGIN_PARAMETERS_INVALID",
        "auth.loginParameters",
        "Microsoft Entra login parameters must be an explicit array.",
      );
    } else if (!loginParameters.every((parameter) => /^[^=\s]+=\S+$/u.test(parameter))) {
      add(
        "AUTH_LOGIN_PARAMETERS_INVALID",
        "auth.loginParameters",
        "Each Microsoft Entra login parameter must use a non-empty key=value form.",
      );
    }
  }
  for (const field of ["allowedIdentities", "allowedClientApplications", "allowedGroups"]) {
    const path = `auth.${field}`;
    const principals = get(config, path);
    if (field === "allowedIdentities" && (!Array.isArray(principals) || principals.length === 0)) {
      add(
        "ALLOWED_IDENTITIES_REQUIRED",
        path,
        "Production requires at least one explicitly allowed identity.",
      );
    }
    if (!Array.isArray(principals)) {
      add("AUTH_PRINCIPAL_LIST_INVALID", path, `${path} must be an explicit array of UUIDs.`);
      continue;
    }
    principals.forEach((principal, index) => {
      if (!UUID_PATTERN.test(principal ?? "")) {
        add(
          "AUTH_PRINCIPAL_ID_INVALID",
          `${path}.${index}`,
          "Allowed identity, application, and group values must be concrete UUIDs.",
        );
      }
    });
    const normalizedPrincipals = principals.map((principal) =>
      typeof principal === "string" ? principal.toLowerCase() : "",
    );
    if (new Set(normalizedPrincipals).size !== normalizedPrincipals.length) {
      add("AUTH_PRINCIPAL_ID_DUPLICATE", path, `${path} values must be unique.`);
    }
  }
  if (!isTrue(get(config, "auth.forwardedHostTrustApproved"))) {
    add(
      "FORWARDED_HOST_TRUST_UNAPPROVED",
      "auth.forwardedHostTrustApproved",
      "Application Gateway forwarded host/protocol handling must be approved.",
    );
  }
  if (get(config, "auth.provider") === "customOidc") {
    for (const field of [
      "customProviderName",
      "authorizationEndpoint",
      "certificationUri",
      "tokenEndpoint",
      "wellKnownOpenIdConfiguration",
      "nameClaimType",
    ]) {
      requireString(`auth.${field}`, "CUSTOM_OIDC_CONFIGURATION_REQUIRED");
    }
    if (!isStringArray(get(config, "auth.scopes"))) {
      add(
        "CUSTOM_OIDC_SCOPES_REQUIRED",
        "auth.scopes",
        "Custom OIDC requires at least one explicit non-empty scope.",
      );
    }
    for (const field of [
      "authorizationEndpoint",
      "certificationUri",
      "tokenEndpoint",
      "wellKnownOpenIdConfiguration",
    ]) {
      if (!isHttpsUrl(get(config, `auth.${field}`))) {
        add(
          "CUSTOM_OIDC_ENDPOINT_INVALID",
          `auth.${field}`,
          "Custom OIDC endpoints must use HTTPS.",
        );
      }
    }
  } else if (
    isHttpsUrl(get(config, "auth.issuer")) &&
    UUID_PATTERN.test(get(config, "auth.tenantId") ?? "")
  ) {
    const issuer = new URL(get(config, "auth.issuer"));
    if (!MICROSOFT_ENTRA_ISSUER_HOSTS.has(issuer.hostname.toLowerCase())) {
      add(
        "ENTRA_ISSUER_HOST_INVALID",
        "auth.issuer",
        "The Microsoft Entra issuer must use a recognized Microsoft identity host.",
      );
    }
    const tenantId = get(config, "auth.tenantId").toLowerCase();
    const issuerPathSegments = issuer.pathname
      .toLowerCase()
      .split("/")
      .filter((segment) => segment.length > 0);
    if (!issuerPathSegments.includes(tenantId)) {
      add(
        "ENTRA_ISSUER_TENANT_MISMATCH",
        "auth.issuer",
        "The Microsoft identity issuer path must contain the configured tenant ID.",
      );
    }
  }

  if (!isTrue(get(config, "accessPolicies.privateDataPlanesRequired"))) {
    add(
      "PRIVATE_DATA_PLANE_POLICY_REQUIRED",
      "accessPolicies.privateDataPlanesRequired",
      "Restricted production must require private data planes.",
    );
  }
  if (!isTrue(get(config, "accessPolicies.managedIdentityRequired"))) {
    add(
      "MANAGED_IDENTITY_POLICY_REQUIRED",
      "accessPolicies.managedIdentityRequired",
      "Managed identity must be required.",
    );
  }
  if (!isTrue(get(config, "accessPolicies.localAuthDisabled"))) {
    add(
      "LOCAL_AUTH_POLICY_INVALID",
      "accessPolicies.localAuthDisabled",
      "Local/key authentication must remain disabled.",
    );
  }
  if (!isTrue(get(config, "accessPolicies.diagnosticDataApproved"))) {
    add(
      "DIAGNOSTIC_DATA_APPROVAL_REQUIRED",
      "accessPolicies.diagnosticDataApproved",
      "Diagnostic categories and data handling require explicit approval.",
    );
  }
  for (const field of PRIVATE_DATA_PLANE_FIELDS) {
    if (get(config, `dataPlanes.${field}`) !== "Disabled") {
      add(
        "PUBLIC_DATA_PLANE_PROHIBITED",
        `dataPlanes.${field}`,
        `${field} must be Disabled for Restricted production.`,
      );
    }
  }

  if (
    isTrue(get(config, "globalEdge.enabled")) &&
    !isNonEmptyString(get(config, "globalEdge.approvalReference"))
  ) {
    add(
      "GLOBAL_EDGE_UNAPPROVED",
      "globalEdge",
      "A global request-processing edge requires an explicit approval reference.",
    );
  }

  if (
    get(config, "delivery.privateAcrRunnerType") !== "vnetConnected" ||
    !isTrue(get(config, "delivery.privateAcrRunnerApproved"))
  ) {
    add(
      "PRIVATE_ACR_RUNNER_REQUIRED",
      "delivery",
      "Private ACR delivery requires an approved VNet-connected runner; GitHub-hosted runners are insufficient.",
    );
  }

  const configuredFoundryDeploymentTypes = get(config, "foundry.deploymentTypes");
  const foundryModelDeployments = get(config, "foundry.modelDeployments");
  const foundryDeploymentTypes = [
    ...(Array.isArray(configuredFoundryDeploymentTypes) ? configuredFoundryDeploymentTypes : []),
    ...(Array.isArray(foundryModelDeployments)
      ? foundryModelDeployments.map(
          (deployment) => deployment?.deploymentType ?? deployment?.sku ?? "",
        )
      : []),
  ];
  foundryDeploymentTypes.forEach((deploymentType, index) => {
    if (/global|data[\s-]?zone/i.test(String(deploymentType))) {
      add(
        "FOUNDRY_NONREGIONAL_DEPLOYMENT_PROHIBITED",
        `foundry.deploymentTypes.${index}`,
        "Global and DataZone Foundry deployment types are prohibited for Restricted data.",
      );
    }
  });
  if ((Array.isArray(foundryModelDeployments) ? foundryModelDeployments.length : 0) > 0) {
    add(
      "FOUNDRY_MODEL_DEPLOYMENT_OUT_OF_SCOPE",
      "foundry.modelDeployments",
      "This foundation must not select or deploy a model.",
    );
  }

  const foundryFeatureEnabled = isTrue(get(config, "features.enableFoundry"));
  const foundryConfigurationEnabled = isTrue(get(config, "foundry.enabled"));
  const foundryParameterEnabled = parameterFeatures?.enableFoundry === true;
  const foundryRequested =
    foundryFeatureEnabled || foundryConfigurationEnabled || foundryParameterEnabled;

  if (foundryRequested) {
    add(
      "FOUNDRY_MUST_REMAIN_DISABLED",
      "features.enableFoundry",
      "Foundry is a nondeployable boundary until every Standard Agent Setup data-plane role can be expressed with supported GA automation.",
    );
    if (
      !Array.isArray(configuredFoundryDeploymentTypes) ||
      configuredFoundryDeploymentTypes.length !== 1 ||
      configuredFoundryDeploymentTypes[0] !== "RegionalStandard"
    ) {
      add(
        "FOUNDRY_REGIONAL_STANDARD_POLICY_REQUIRED",
        "foundry.deploymentTypes",
        "Restricted Foundry admission requires an explicit RegionalStandard-only deployment policy without selecting a model.",
      );
    }
    for (const [field, approval] of FOUNDRY_APPROVAL_GATES) {
      if (!isTrue(get(config, `foundry.${field}`))) {
        add(
          "FOUNDRY_GATE_INCOMPLETE",
          `foundry.${field}`,
          `Foundry approval for ${approval} must be explicitly true before admission.`,
        );
      }
    }
  }
  if (
    (foundryFeatureEnabled && !foundryConfigurationEnabled) ||
    (foundryConfigurationEnabled && !foundryFeatureEnabled)
  ) {
    add(
      "FOUNDRY_ENABLEMENT_MISMATCH",
      "foundry.enabled",
      "The feature flag and Foundry configuration enablement must match.",
    );
  }

  if (parameterFeatures) {
    for (const [feature, parameterValue] of Object.entries(parameterFeatures)) {
      if (
        typeof parameterValue === "boolean" &&
        get(config, `features.${feature}`) !== parameterValue
      ) {
        add(
          "FEATURE_PARAMETER_MISMATCH",
          `parameters.${feature}`,
          `${feature} must match config.features.${feature}.`,
        );
      }
    }
  }

  return sortValidationErrors(errors);
}

function parseArguments(argv) {
  const options = {
    configPath: "",
    expectFailure: false,
    json: false,
    mode: "production",
    quiet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--config") {
      options.configPath = argv[index + 1] ?? "";
      index += 1;
    } else if (argument === "--mode") {
      options.mode = argv[index + 1] ?? "";
      index += 1;
    } else if (argument === "--expect-failure") {
      options.expectFailure = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--quiet") {
      options.quiet = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.configPath) {
    throw new Error("--config <path> is required");
  }
  if (!["compile-only", "production"].includes(options.mode)) {
    throw new Error("--mode must be production or compile-only");
  }

  return options;
}

export async function runCli(argv) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    console.error(`Preflight argument error: ${error.message}`);
    return 2;
  }

  let document;
  try {
    document = JSON.parse(await readFile(options.configPath, "utf8"));
  } catch (error) {
    console.error(`Unable to read preflight configuration: ${error.message}`);
    return 2;
  }

  const errors =
    options.mode === "compile-only"
      ? validateCompileOnlyConfig(document)
      : validateProductionConfig(document);
  if (options.json && !options.quiet) {
    console.log(
      JSON.stringify(
        {
          errors,
          mode: options.mode,
          monitoringPosture: getMonitoringPreflightPosture(document),
          valid: errors.length === 0,
        },
        null,
        2,
      ),
    );
  } else if (!options.quiet) {
    if (errors.length === 0) {
      console.log(
        options.mode === "compile-only"
          ? "Compile-only fixture validation passed; no production admission was granted."
          : "Production preflight passed.",
      );
    } else {
      console.error(
        `${options.mode === "compile-only" ? "Compile-only validation" : "Production preflight"} rejected configuration (${errors.length} errors):`,
      );
      for (const error of errors) {
        console.error(`- [${error.code}] ${error.path}: ${error.message}`);
      }
    }
  }

  if (options.expectFailure) {
    return errors.length > 0 ? 0 : 1;
  }
  return errors.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
