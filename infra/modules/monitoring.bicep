targetScope = 'resourceGroup'

param location string
param amplsLocation string
param names object
param monitoring object
param tags object
param enableAmpls bool = true

var logAnalyticsDataReaderRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '3b03c2da-16b3-4a49-8834-0f8130efdd3b'
)

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2025-07-01' = {
  name: names.logAnalytics
  location: location
  tags: tags
  properties: {
    features: {
      disableLocalAuth: true
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Disabled'
    publicNetworkAccessForQuery: 'Disabled'
    retentionInDays: monitoring.logRetentionDays
    sku: {
      name: monitoring.logAnalyticsSku
    }
    workspaceCapping: {
      dailyQuotaGb: monitoring.dailyQuotaGb
    }
  }
}

resource rolloutQueryRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(logAnalytics.id, monitoring.queryAccess.principalId, logAnalyticsDataReaderRoleId)
  scope: logAnalytics
  properties: {
    principalId: monitoring.queryAccess.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: logAnalyticsDataReaderRoleId
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: names.applicationInsights
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    DisableIpMasking: false
    DisableLocalAuth: true
    IngestionMode: 'LogAnalytics'
    RetentionInDays: monitoring.applicationInsightsRetentionDays
    WorkspaceResourceId: logAnalytics.id
    publicNetworkAccessForIngestion: 'Disabled'
    publicNetworkAccessForQuery: 'Disabled'
  }
}

resource monitorPrivateLinkScope 'Microsoft.Insights/privateLinkScopes@2021-09-01' = if (enableAmpls) {
  name: names.monitorPrivateLinkScope
  location: amplsLocation
  tags: tags
  properties: {
    accessModeSettings: {
      ingestionAccessMode: 'PrivateOnly'
      queryAccessMode: 'PrivateOnly'
    }
  }
}

resource workspaceScope 'Microsoft.Insights/privateLinkScopes/scopedResources@2021-09-01' = if (enableAmpls) {
  parent: monitorPrivateLinkScope
  name: 'log-analytics'
  properties: {
    linkedResourceId: logAnalytics.id
  }
}

resource applicationInsightsScope 'Microsoft.Insights/privateLinkScopes/scopedResources@2021-09-01' = if (enableAmpls) {
  parent: monitorPrivateLinkScope
  name: 'application-insights'
  properties: {
    linkedResourceId: applicationInsights.id
  }
}

output logAnalyticsWorkspaceId string = logAnalytics.id
output applicationInsightsId string = applicationInsights.id
output monitorPrivateLinkScopeId string = enableAmpls ? monitorPrivateLinkScope!.id : ''
output monitoringAccess object = {
  assignedByIaC: true
  clientId: monitoring.queryAccess.clientId
  identityType: monitoring.queryAccess.identityType
  principalId: monitoring.queryAccess.principalId
  roleDefinitionId: logAnalyticsDataReaderRoleId
  roleName: 'Log Analytics Data Reader'
  scope: logAnalytics.id
  externalControls: [
    {
      control: 'federatedIdentityCredential'
      managedBy: 'protected-environment-administration'
    }
    {
      control: 'protectedEnvironmentVariable'
      name: monitoring.queryAccess.protectedEnvironmentVariable
    }
    {
      control: 'privateQueryNetworkPath'
      requirement: 'The rollout query runs only from the approved VNet-connected production runner through AMPLS.'
    }
  ]
}
output monitoringPosture object = {
  applicationInsights: {
    exportStatus: monitoring.runtimeExporter.status
    exporter: monitoring.runtimeExporter.exporter
    id: applicationInsights.id
    runtimeTelemetryMode: monitoring.runtimeExporter.telemetryMode
    disabledReason: monitoring.runtimeExporter.disabledReason
  }
  dataCollection: {
    dataCollectionEndpointRequired: monitoring.dataCollection.dataCollectionEndpointRequired
    dataCollectionRuleRequired: monitoring.dataCollection.dataCollectionRuleRequired
  }
  location: location
  privateLink: {
    amplsEnabled: enableAmpls
    amplsLocation: amplsLocation
    ingestionAccessMode: enableAmpls ? 'PrivateOnly' : 'Unavailable'
    queryAccessMode: enableAmpls ? 'PrivateOnly' : 'Unavailable'
  }
  publicNetworkAccess: {
    ingestion: 'Disabled'
    query: 'Disabled'
  }
  retention: {
    applicationInsightsRetentionInDays: monitoring.applicationInsightsRetentionDays
    logAnalyticsRetentionInDays: monitoring.logRetentionDays
    workspaceControlsApplicationTelemetryRetention: true
  }
  runtimeLogs: monitoring.runtimeLogs
}
output monitoringException string = enableAmpls
  ? 'AMPLS private ingestion/query are modeled. Runtime application trace export remains scaffolded-disabled under the separately reviewed telemetry posture.'
  : 'GATED EXCEPTION: AMPLS is disabled. Production preflight must reject this until a reviewed private telemetry alternative is recorded.'
