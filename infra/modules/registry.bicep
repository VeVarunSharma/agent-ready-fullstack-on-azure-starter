targetScope = 'resourceGroup'

param location string
param registryName string
param registry object
param appPrincipalId string
param migrationPrincipalId string
param tags object
param logAnalyticsWorkspaceId string
param diagnosticCategories array
param enableDiagnostics bool = false

var acrPullRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2025-11-01' = {
  name: registryName
  location: location
  sku: {
    name: registry.sku
  }
  tags: tags
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    dataEndpointEnabled: false
    networkRuleBypassOptions: 'None'
    policies: {
      azureADAuthenticationAsArmPolicy: {
        status: 'enabled'
      }
      exportPolicy: {
        status: 'disabled'
      }
      quarantinePolicy: {
        status: 'disabled'
      }
      retentionPolicy: {
        days: registry.retentionDays
        status: 'enabled'
      }
      trustPolicy: {
        type: 'Notary'
        status: 'disabled'
      }
    }
    publicNetworkAccess: 'Disabled'
    zoneRedundancy: registry.zoneRedundancy
  }
}

resource appPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, 'app', acrPullRoleId)
  scope: containerRegistry
  properties: {
    principalId: appPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleId
  }
}

resource migrationPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, 'migration', acrPullRoleId)
  scope: containerRegistry
  properties: {
    principalId: migrationPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleId
  }
}

resource registryDiagnostics 'Microsoft.Insights/diagnosticSettings@2016-09-01' = if (enableDiagnostics) {
  name: 'service'
  location: location
  scope: containerRegistry
  properties: {
    logs: [
      for category in diagnosticCategories: {
        category: category
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
    ]
    metrics: []
    workspaceId: logAnalyticsWorkspaceId
  }
}

output registryId string = containerRegistry.id
output loginServer string = containerRegistry.properties.loginServer
