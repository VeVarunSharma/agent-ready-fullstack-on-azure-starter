targetScope = 'resourceGroup'

param config object
param enableFoundry bool = false
param enableFirewall bool = false
param enableAmpls bool = true
param enableDiagnostics bool = false
param deploymentStage string
param imageDigest string
param previousRevisionName string
param webRevisionSuffix string

var resourceTags = union(config.tags, {
  environment: config.environmentName
  workload: config.workloadName
})
var deployMigrationJob = deploymentStage == 'migration' || deploymentStage == 'application'
var deployWebApp = deploymentStage == 'application'

module network './network.bicep' = {
  name: 'network'
  params: {
    enableFirewall: enableFirewall
    firewall: config.egress.firewall
    location: config.resourceLocations.network
    names: config.names
    network: config.network
    tags: resourceTags
  }
}

module monitoring './monitoring.bicep' = {
  name: 'monitoring'
  params: {
    amplsLocation: config.monitoring.amplsLocation
    enableAmpls: enableAmpls
    location: config.resourceLocations.monitoring
    monitoring: config.monitoring
    names: config.names
    tags: resourceTags
  }
}

module security './security.bicep' = {
  name: 'security'
  params: {
    diagnosticCategories: config.diagnostics.keyVault
    enableDiagnostics: enableDiagnostics
    keyVault: config.keyVault
    location: config.resourceLocations.security
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    names: config.names
    tags: resourceTags
    tenantId: config.auth.tenantId
  }
}

module registry './registry.bicep' = {
  name: 'registry'
  params: {
    appPrincipalId: security.outputs.appIdentityPrincipalId
    diagnosticCategories: config.diagnostics.containerRegistry
    enableDiagnostics: enableDiagnostics
    location: config.resourceLocations.compute
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    migrationPrincipalId: security.outputs.migrationIdentityPrincipalId
    registry: config.containerRegistry
    registryName: config.names.containerRegistry
    tags: resourceTags
  }
}

module data './data.bicep' = {
  name: 'data'
  params: {
    diagnosticCategories: config.diagnostics.postgres
    enableDiagnostics: enableDiagnostics
    location: config.resourceLocations.data
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    names: config.names
    postgres: config.postgres
    tags: resourceTags
    tenantId: config.auth.tenantId
  }
}

var corePrivateEndpoints = concat(
  [
    {
      name: config.names.containerRegistryPrivateEndpoint
      targetResourceId: registry.outputs.registryId
      groupIds: [
        'registry'
      ]
      dnsZoneNames: config.privateDnsZones.containerRegistry
    }
    {
      name: config.names.keyVaultPrivateEndpoint
      targetResourceId: security.outputs.keyVaultId
      groupIds: [
        'vault'
      ]
      dnsZoneNames: config.privateDnsZones.keyVault
    }
    {
      name: config.names.postgresPrivateEndpoint
      targetResourceId: data.outputs.postgresServerId
      groupIds: [
        'postgresqlServer'
      ]
      dnsZoneNames: config.privateDnsZones.postgres
    }
  ],
  enableAmpls
    ? [
        {
          name: config.names.monitorPrivateEndpoint
          targetResourceId: monitoring.outputs.monitorPrivateLinkScopeId
          groupIds: [
            'azuremonitor'
          ]
          dnsZoneNames: config.privateDnsZones.azureMonitor
        }
      ]
    : []
)

var allPrivateDnsZones = union(
  config.privateDnsZones.containerRegistry,
  config.privateDnsZones.keyVault,
  config.privateDnsZones.postgres,
  config.privateDnsZones.azureMonitor
)

module privateNetworking './private-networking.bicep' = {
  name: 'private-networking'
  params: {
    dnsZoneNames: allPrivateDnsZones
    endpoints: corePrivateEndpoints
    location: config.resourceLocations.network
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    tags: resourceTags
    virtualNetworkId: network.outputs.virtualNetworkId
  }
}

module containerApps './container-apps.bicep' = {
  name: 'container-apps'
  params: {
    appGatewaySubnetPrefix: config.network.subnets.applicationGateway
    appIdentityClientId: security.outputs.appIdentityClientId
    appIdentityId: security.outputs.appIdentityId
    auth: config.auth
    containerApps: config.containerApps
    database: {
      appPrincipalName: config.postgres.appPrincipalName
      host: data.outputs.postgresHost
      migrationPrincipalName: config.postgres.migrationPrincipalName
      name: data.outputs.databaseName
    }
    deployMigrationJob: deployMigrationJob
    deployWebApp: deployWebApp
    enableDiagnostics: enableDiagnostics
    environmentDiagnosticCategories: union(config.diagnostics.containerAppsEnvironment, config.diagnostics.containerApp)
    image: config.image
    imageDigest: imageDigest
    infrastructureSubnetId: network.outputs.containerAppsSubnetId
    location: config.resourceLocations.compute
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    migrationIdentityClientId: security.outputs.migrationIdentityClientId
    migrationIdentityId: security.outputs.migrationIdentityId
    names: config.names
    previousRevisionName: previousRevisionName
    registryLoginServer: registry.outputs.loginServer
    tags: resourceTags
    virtualNetworkId: network.outputs.virtualNetworkId
    webRevisionSuffix: webRevisionSuffix
  }
  dependsOn: [
    privateNetworking
  ]
}

module ingress './ingress.bicep' = if (deployWebApp) {
  name: 'ingress'
  params: {
    appGatewaySubnetId: network.outputs.appGatewaySubnetId
    applicationGateway: config.applicationGateway
    backendFqdn: containerApps.outputs.webAppFqdn
    diagnosticCategories: config.diagnostics.applicationGateway
    enableDiagnostics: enableDiagnostics
    gatewayIdentityId: security.outputs.gatewayIdentityId
    location: config.resourceLocations.ingress
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    names: config.names
    publicHost: config.dns.publicHost
    tags: resourceTags
    tlsCertificateVersionedUri: config.tls.certificateVersionedSecretUri
  }
}

module foundry './foundry.bicep' = if (enableFoundry) {
  name: 'foundry-nondeployable-boundary'
  params: {
    enableFoundry: enableFoundry
  }
}

output privateAcrDeliveryRequirement string = 'The registry has no public data plane. Image build and push must use an approved VNet-connected runner or an explicitly reviewed private build path; GitHub-hosted runners cannot reach its private endpoint.'
output postProvisioningGates array = [
  'Run production preflight before any what-if or deployment.'
  'Seed the versioned TLS certificate in Key Vault before Application Gateway provisioning.'
  'Bootstrap PostgreSQL Entra principals and least-privilege grants with the private migration job identity.'
  'Verify diagnostic categories read-only in the target subscription before enabling diagnostic settings.'
  'Keep runtime application trace export disabled until a stable compatible GA exporter and loader contract pass review.'
  'Keep the nondeployable Foundry boundary disabled until every GA surface, generated data-plane role, region, policy, terms, retention, deletion, and store approval passes.'
  network.outputs.egressStatus
  monitoring.outputs.monitoringException
  data.outputs.databaseBootstrapRequired
]
output monitoringPosture object = union(monitoring.outputs.monitoringPosture, {
  diagnostics: {
    categories: config.diagnostics
    destination: monitoring.outputs.logAnalyticsWorkspaceId
    enabled: enableDiagnostics
  }
  queryAccess: monitoring.outputs.monitoringAccess
})
output foundryStatus string = enableFoundry
  ? foundry!.outputs.posture
  : 'Foundry is absent: no resource, DNS zone, RBAC assignment, data plane, model, or agent is selected or deployed.'
