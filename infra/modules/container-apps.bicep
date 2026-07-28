targetScope = 'resourceGroup'

param location string
param names object
param containerApps object
param image object
param imageDigest string
param auth object
param database object
param virtualNetworkId string
param infrastructureSubnetId string
param appGatewaySubnetPrefix string
param appIdentityId string
param appIdentityClientId string
param migrationIdentityId string
param migrationIdentityClientId string
param registryLoginServer string
param tags object
param logAnalyticsWorkspaceId string
param environmentDiagnosticCategories array
param deployMigrationJob bool
param deployWebApp bool
param previousRevisionName string
param webRevisionSuffix string
param enableDiagnostics bool = false

var imageReference = '${registryLoginServer}/${image.repository}@${imageDigest}'
var authSecretName = 'oidc-client-secret'
var ingressRestrictions = empty(previousRevisionName)
  ? [
      {
        action: 'Deny'
        description: 'First-bootstrap candidate remains unreachable until post-migration acceptance.'
        ipAddressRange: '0.0.0.0/0'
        name: 'staged-deny-all'
      }
    ]
  : [
      {
        action: 'Allow'
        description: 'Only the regional Application Gateway subnet may reach app ingress.'
        ipAddressRange: appGatewaySubnetPrefix
        name: 'application-gateway-only'
      }
    ]
var entraIdentityProvider = {
  azureActiveDirectory: {
    enabled: true
    isAutoProvisioned: false
    login: {
      disableWWWAuthenticate: false
      loginParameters: auth.loginParameters
    }
    registration: {
      clientId: auth.clientId
      clientSecretSettingName: authSecretName
      openIdIssuer: auth.issuer
    }
    validation: {
      allowedAudiences: [
        auth.audience
      ]
      defaultAuthorizationPolicy: {
        allowedApplications: auth.allowedClientApplications
        allowedPrincipals: {
          groups: auth.allowedGroups
          identities: auth.allowedIdentities
        }
      }
      jwtClaimChecks: {
        allowedClientApplications: auth.allowedClientApplications
        allowedGroups: auth.allowedGroups
      }
    }
  }
}
var customIdentityProvider = {
  customOpenIdConnectProviders: {
    '${auth.customProviderName}': {
      enabled: true
      login: {
        nameClaimType: auth.nameClaimType
        scopes: auth.scopes
      }
      registration: {
        clientCredential: {
          clientSecretSettingName: authSecretName
          method: 'ClientSecretPost'
        }
        clientId: auth.clientId
        openIdConnectConfiguration: {
          authorizationEndpoint: auth.authorizationEndpoint
          certificationUri: auth.certificationUri
          issuer: auth.issuer
          tokenEndpoint: auth.tokenEndpoint
          wellKnownOpenIdConfiguration: auth.wellKnownOpenIdConfiguration
        }
      }
    }
  }
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2026-01-01' = {
  name: names.containerAppsEnvironment
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'azure-monitor'
    }
    infrastructureResourceGroup: names.containerAppsInfrastructureResourceGroup
    ingressConfiguration: {
      headerCountLimit: containerApps.ingress.headerCountLimit
      requestIdleTimeout: containerApps.ingress.requestIdleTimeoutMinutes
      terminationGracePeriodSeconds: containerApps.ingress.terminationGracePeriodSeconds
      workloadProfileName: containerApps.workloadProfile.name
    }
    peerAuthentication: {
      mtls: {
        enabled: true
      }
    }
    peerTrafficConfiguration: {
      encryption: {
        enabled: true
      }
    }
    publicNetworkAccess: 'Disabled'
    vnetConfiguration: {
      dockerBridgeCidr: containerApps.network.dockerBridgeCidr
      infrastructureSubnetId: infrastructureSubnetId
      internal: true
      platformReservedCidr: containerApps.network.platformReservedCidr
      platformReservedDnsIP: containerApps.network.platformReservedDnsIp
    }
    workloadProfiles: [
      {
        maximumCount: containerApps.workloadProfile.maximumCount
        minimumCount: containerApps.workloadProfile.minimumCount
        name: containerApps.workloadProfile.name
        workloadProfileType: containerApps.workloadProfile.type
      }
    ]
    zoneRedundant: containerApps.zoneRedundant
  }
}

resource webApp 'Microsoft.App/containerApps@2026-01-01' = if (deployWebApp) {
  name: names.webContainerApp
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${appIdentityId}': {}
    }
  }
  tags: tags
  properties: {
    configuration: {
      activeRevisionsMode: 'Multiple'
      identitySettings: [
        {
          identity: appIdentityId
          lifecycle: 'All'
        }
      ]
      ingress: {
        allowInsecure: false
        external: !empty(previousRevisionName)
        ipSecurityRestrictions: ingressRestrictions
        stickySessions: {
          affinity: 'none'
        }
        targetPort: containerApps.app.targetPort
        traffic: empty(previousRevisionName)
          ? [
              {
                latestRevision: true
                weight: 100
              }
            ]
          : [
              {
                revisionName: previousRevisionName
                weight: 100
              }
              {
                latestRevision: true
                weight: 0
              }
            ]
        transport: 'Auto'
      }
      registries: [
        {
          identity: appIdentityId
          server: registryLoginServer
        }
      ]
      secrets: [
        {
          identity: appIdentityId
          keyVaultUrl: auth.clientSecretKeyVaultUrl
          name: authSecretName
        }
      ]
    }
    managedEnvironmentId: managedEnvironment.id
    template: {
      revisionSuffix: webRevisionSuffix
      containers: [
        {
          name: 'web'
          image: imageReference
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: string(containerApps.app.targetPort)
            }
            {
              name: 'RUNTIME_MODE'
              value: 'production'
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: appIdentityClientId
            }
            {
              name: 'DATABASE_MODE'
              value: 'azure-managed-identity'
            }
            {
              name: 'DATABASE_HOST'
              value: database.host
            }
            {
              name: 'DATABASE_PORT'
              value: '5432'
            }
            {
              name: 'DATABASE_NAME'
              value: database.name
            }
            {
              name: 'DATABASE_USER'
              value: database.appPrincipalName
            }
            {
              name: 'DATABASE_POOL_MAX'
              value: '10'
            }
            {
              name: 'DATABASE_PROBE_TIMEOUT_MS'
              value: '2000'
            }
            {
              name: 'AUTH_MODE'
              value: 'container-apps'
            }
            {
              name: 'LOGGING_MODE'
              value: 'json'
            }
            {
              name: 'TELEMETRY_MODE'
              value: 'disabled'
            }
          ]
          probes: [
            {
              failureThreshold: 3
              httpGet: {
                path: '/health/live'
                port: containerApps.app.targetPort
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 10
              successThreshold: 1
              timeoutSeconds: 3
              type: 'Liveness'
            }
            {
              failureThreshold: 3
              httpGet: {
                path: '/health/ready'
                port: containerApps.app.targetPort
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 10
              successThreshold: 1
              timeoutSeconds: 3
              type: 'Readiness'
            }
          ]
          resources: {
            cpu: containerApps.app.cpu
            memory: containerApps.app.memory
          }
        }
      ]
      scale: {
        cooldownPeriod: containerApps.app.scale.cooldownSeconds
        maxReplicas: containerApps.app.scale.maximumReplicas
        minReplicas: containerApps.app.scale.minimumReplicas
        pollingInterval: containerApps.app.scale.pollingIntervalSeconds
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: string(containerApps.app.scale.concurrentRequests)
              }
            }
          }
        ]
      }
      terminationGracePeriodSeconds: containerApps.app.terminationGracePeriodSeconds
    }
    workloadProfileName: containerApps.workloadProfile.name
  }
}

resource webAuth 'Microsoft.App/containerApps/authConfigs@2026-01-01' = if (deployWebApp) {
  parent: webApp
  name: 'current'
  properties: {
    globalValidation: {
      excludedPaths: [
        '/health/live'
        '/health/ready'
      ]
      redirectToProvider: auth.provider == 'microsoftEntra' ? 'azureactivedirectory' : auth.customProviderName
      unauthenticatedClientAction: 'RedirectToLoginPage'
    }
    httpSettings: {
      forwardProxy: {
        convention: 'Standard'
      }
      requireHttps: true
      routes: {
        apiPrefix: '/.auth'
      }
    }
    identityProviders: auth.provider == 'microsoftEntra' ? entraIdentityProvider : customIdentityProvider
    login: {
      allowedExternalRedirectUrls: auth.callbackUrls
      cookieExpiration: {
        convention: 'FixedTime'
        timeToExpiration: auth.cookieExpiration
      }
      nonce: {
        nonceExpirationInterval: auth.nonceExpiration
        validateNonce: true
      }
      preserveUrlFragmentsForLogins: false
      routes: {
        logoutEndpoint: '/.auth/logout'
      }
      tokenStore: {
        enabled: false
      }
    }
    platform: {
      enabled: true
      runtimeVersion: '~1'
    }
  }
}

resource migrationJob 'Microsoft.App/jobs@2026-01-01' = if (deployMigrationJob) {
  name: names.migrationJob
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${migrationIdentityId}': {}
    }
  }
  tags: tags
  properties: {
    configuration: {
      identitySettings: [
        {
          identity: migrationIdentityId
          lifecycle: 'All'
        }
      ]
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          identity: migrationIdentityId
          server: registryLoginServer
        }
      ]
      replicaRetryLimit: containerApps.migration.retryLimit
      replicaTimeout: containerApps.migration.timeoutSeconds
      triggerType: 'Manual'
    }
    environmentId: managedEnvironment.id
    template: {
      containers: [
        {
          name: 'migration'
          image: imageReference
          command: image.migrationCommand
          args: image.migrationArguments
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'RUNTIME_MODE'
              value: 'production'
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: migrationIdentityClientId
            }
            {
              name: 'DATABASE_MODE'
              value: 'azure-managed-identity'
            }
            {
              name: 'DATABASE_HOST'
              value: database.host
            }
            {
              name: 'DATABASE_PORT'
              value: '5432'
            }
            {
              name: 'DATABASE_NAME'
              value: database.name
            }
            {
              name: 'DATABASE_USER'
              value: database.migrationPrincipalName
            }
            {
              name: 'DATABASE_POOL_MAX'
              value: '10'
            }
            {
              name: 'DATABASE_PROBE_TIMEOUT_MS'
              value: '2000'
            }
            {
              name: 'AUTH_MODE'
              value: 'container-apps'
            }
            {
              name: 'LOGGING_MODE'
              value: 'json'
            }
            {
              name: 'TELEMETRY_MODE'
              value: 'disabled'
            }
          ]
          resources: {
            cpu: containerApps.migration.cpu
            memory: containerApps.migration.memory
          }
        }
      ]
    }
    workloadProfileName: containerApps.workloadProfile.name
  }
}

module environmentDns './container-apps-dns.bicep' = {
  name: 'container-apps-private-dns'
  params: {
    environmentDefaultDomain: managedEnvironment.properties.defaultDomain
    environmentStaticIp: managedEnvironment.properties.staticIp
    tags: tags
    virtualNetworkId: virtualNetworkId
  }
}

resource environmentDiagnostics 'Microsoft.Insights/diagnosticSettings@2016-09-01' = if (enableDiagnostics) {
  name: 'service'
  scope: managedEnvironment
  location: location
  properties: {
    logs: [
      for category in environmentDiagnosticCategories: {
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

resource appDiagnostics 'Microsoft.Insights/diagnosticSettings@2016-09-01' = if (enableDiagnostics && deployWebApp) {
  name: 'service'
  scope: webApp
  location: location
  properties: {
    logs: []
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

output environmentId string = managedEnvironment.id
output environmentStaticIp string = managedEnvironment.properties.staticIp
output environmentDefaultDomain string = managedEnvironment.properties.defaultDomain
output webAppId string = deployWebApp ? webApp!.id : ''
output webAppFqdn string = deployWebApp ? webApp!.properties.configuration.ingress.fqdn : ''
output migrationJobId string = deployMigrationJob ? migrationJob!.id : ''
output imageReference string = deployMigrationJob || deployWebApp ? imageReference : ''
