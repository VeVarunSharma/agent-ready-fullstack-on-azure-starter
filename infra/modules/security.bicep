targetScope = 'resourceGroup'

param location string
param names object
param keyVault object
param tenantId string
param tags object
param logAnalyticsWorkspaceId string
param diagnosticCategories array
param enableDiagnostics bool = false

var keyVaultSecretsUserRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '4633458b-17de-408a-b874-0445c86b69e6'
)

resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: names.appIdentity
  location: location
  tags: tags
}

resource migrationIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: names.migrationIdentity
  location: location
  tags: tags
}

resource gatewayIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: names.gatewayIdentity
  location: location
  tags: tags
}

resource vault 'Microsoft.KeyVault/vaults@2026-02-01' = {
  name: names.keyVault
  location: location
  tags: tags
  properties: {
    enablePurgeProtection: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    networkAcls: {
      bypass: 'None'
      defaultAction: 'Deny'
      ipRules: []
      virtualNetworkRules: []
    }
    publicNetworkAccess: 'Disabled'
    sku: {
      family: 'A'
      name: keyVault.sku
    }
    softDeleteRetentionInDays: keyVault.softDeleteRetentionDays
    tenantId: tenantId
  }
}

resource appSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, appIdentity.id, keyVaultSecretsUserRoleId)
  scope: vault
  properties: {
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultSecretsUserRoleId
  }
}

resource gatewayCertificateRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, gatewayIdentity.id, keyVaultSecretsUserRoleId)
  scope: vault
  properties: {
    principalId: gatewayIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultSecretsUserRoleId
  }
}

resource vaultDiagnostics 'Microsoft.Insights/diagnosticSettings@2016-09-01' = if (enableDiagnostics) {
  name: 'service'
  location: location
  scope: vault
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
    metrics: [
      {
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
        timeGrain: 'PT1M'
      }
    ]
    workspaceId: logAnalyticsWorkspaceId
  }
}

output appIdentityId string = appIdentity.id
output appIdentityClientId string = appIdentity.properties.clientId
output appIdentityPrincipalId string = appIdentity.properties.principalId
output migrationIdentityId string = migrationIdentity.id
output migrationIdentityClientId string = migrationIdentity.properties.clientId
output migrationIdentityPrincipalId string = migrationIdentity.properties.principalId
output gatewayIdentityId string = gatewayIdentity.id
output gatewayIdentityPrincipalId string = gatewayIdentity.properties.principalId
output keyVaultId string = vault.id
output keyVaultUri string = vault.properties.vaultUri
