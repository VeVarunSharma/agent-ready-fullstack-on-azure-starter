targetScope = 'resourceGroup'

param location string
param names object
param postgres object
param tenantId string
param tags object
param logAnalyticsWorkspaceId string
param diagnosticCategories array
param enableDiagnostics bool = false

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2025-08-01' = {
  name: names.postgresServer
  location: location
  identity: {
    type: 'None'
  }
  sku: {
    name: postgres.skuName
    tier: postgres.skuTier
  }
  tags: tags
  properties: {
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
      tenantId: tenantId
    }
    availabilityZone: postgres.availabilityZone
    backup: {
      backupRetentionDays: postgres.backupRetentionDays
      geoRedundantBackup: postgres.geoRedundantBackup
    }
    createMode: 'Create'
    highAvailability: {
      mode: postgres.highAvailabilityMode
      standbyAvailabilityZone: postgres.standbyAvailabilityZone
    }
    maintenanceWindow: {
      customWindow: 'Enabled'
      dayOfWeek: postgres.maintenanceWindow.dayOfWeek
      startHour: postgres.maintenanceWindow.startHour
      startMinute: postgres.maintenanceWindow.startMinute
    }
    network: {
      publicNetworkAccess: 'Disabled'
    }
    storage: {
      autoGrow: postgres.storage.autoGrow
      storageSizeGB: postgres.storage.sizeGb
      tier: postgres.storage.tier
      type: postgres.storage.type
    }
    version: postgres.version
  }
}

resource entraAdministrator 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2025-08-01' = {
  parent: postgresServer
  name: postgres.entraAdministratorObjectId
  properties: {
    principalName: postgres.entraAdministratorPrincipalName
    principalType: postgres.entraAdministratorPrincipalType
    tenantId: tenantId
  }
}

resource applicationDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2025-08-01' = {
  parent: postgresServer
  name: names.postgresDatabase
  properties: {
    charset: postgres.databaseCharset
    collation: postgres.databaseCollation
  }
}

resource secureTransport 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2025-08-01' = {
  parent: postgresServer
  name: 'require_secure_transport'
  properties: {
    source: 'user-override'
    value: 'on'
  }
}

resource minimumTls 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2025-08-01' = {
  parent: postgresServer
  name: 'ssl_min_protocol_version'
  properties: {
    source: 'user-override'
    value: postgres.minimumTlsVersion
  }
}

resource postgresDiagnostics 'Microsoft.Insights/diagnosticSettings@2016-09-01' = if (enableDiagnostics) {
  name: 'service'
  location: location
  scope: postgresServer
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

output postgresServerId string = postgresServer.id
output postgresHost string = '${postgresServer.name}.postgres.database.azure.com'
output databaseName string = applicationDatabase.name
output databaseBootstrapRequired string = 'ARM configures Entra authentication but cannot create PostgreSQL principals or grants. Run the separately authorized private migration job bootstrap before starting the app.'
