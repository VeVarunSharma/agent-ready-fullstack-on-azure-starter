targetScope = 'resourceGroup'

param location string
param names object
param applicationGateway object
param publicHost string
param tlsCertificateVersionedUri string
param gatewayIdentityId string
param appGatewaySubnetId string
param backendFqdn string
param tags object
param logAnalyticsWorkspaceId string
param diagnosticCategories array
param enableDiagnostics bool = false

var gatewayFrontendIpId = resourceId(
  'Microsoft.Network/applicationGateways/frontendIPConfigurations',
  names.applicationGateway,
  'public'
)
var gatewayFrontendPortId = resourceId(
  'Microsoft.Network/applicationGateways/frontendPorts',
  names.applicationGateway,
  'https'
)
var gatewayListenerId = resourceId(
  'Microsoft.Network/applicationGateways/httpListeners',
  names.applicationGateway,
  'public-https'
)
var gatewayBackendPoolId = resourceId(
  'Microsoft.Network/applicationGateways/backendAddressPools',
  names.applicationGateway,
  'internal-container-app'
)
var gatewayBackendSettingsId = resourceId(
  'Microsoft.Network/applicationGateways/backendHttpSettingsCollection',
  names.applicationGateway,
  'end-to-end-tls'
)
var gatewayProbeId = resourceId(
  'Microsoft.Network/applicationGateways/probes',
  names.applicationGateway,
  'ready-over-tls'
)
var gatewaySslCertificateId = resourceId(
  'Microsoft.Network/applicationGateways/sslCertificates',
  names.applicationGateway,
  'public-tls'
)
var gatewayRewriteRuleSetId = resourceId(
  'Microsoft.Network/applicationGateways/rewriteRuleSets',
  names.applicationGateway,
  'trusted-forwarded-origin'
)

resource gatewayPublicIp 'Microsoft.Network/publicIPAddresses@2025-07-01' = {
  name: names.applicationGatewayPublicIp
  location: location
  zones: applicationGateway.zones
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  tags: tags
  properties: {
    ddosSettings: {
      protectionMode: 'VirtualNetworkInherited'
    }
    idleTimeoutInMinutes: applicationGateway.publicIpIdleTimeoutMinutes
    publicIPAddressVersion: 'IPv4'
    publicIPAllocationMethod: 'Static'
  }
}

resource wafPolicy 'Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies@2025-07-01' = {
  name: names.applicationGatewayWafPolicy
  location: location
  tags: tags
  properties: {
    customRules: []
    managedRules: {
      exclusions: []
      managedRuleSets: [
        {
          ruleSetType: 'OWASP'
          ruleSetVersion: applicationGateway.wafRuleSetVersion
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: applicationGateway.botManagerRuleSetVersion
        }
      ]
    }
    policySettings: {
      fileUploadLimitInMb: applicationGateway.waf.fileUploadLimitMb
      jsChallengeCookieExpirationInMins: applicationGateway.waf.jsChallengeCookieExpirationMinutes
      maxRequestBodySizeInKb: applicationGateway.waf.maximumRequestBodySizeKb
      mode: 'Prevention'
      requestBodyCheck: true
      requestBodyEnforcement: true
      requestBodyInspectLimitInKB: applicationGateway.waf.requestBodyInspectLimitKb
      state: 'Enabled'
    }
  }
}

resource gateway 'Microsoft.Network/applicationGateways@2025-07-01' = {
  name: names.applicationGateway
  location: location
  zones: applicationGateway.zones
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${gatewayIdentityId}': {}
    }
  }
  tags: tags
  properties: {
    autoscaleConfiguration: {
      maxCapacity: applicationGateway.autoscale.maximumCapacity
      minCapacity: applicationGateway.autoscale.minimumCapacity
    }
    backendAddressPools: [
      {
        name: 'internal-container-app'
        properties: {
          backendAddresses: [
            {
              fqdn: backendFqdn
            }
          ]
        }
      }
    ]
    backendHttpSettingsCollection: [
      {
        name: 'end-to-end-tls'
        properties: {
          connectionDraining: {
            drainTimeoutInSec: applicationGateway.backend.drainTimeoutSeconds
            enabled: true
          }
          cookieBasedAffinity: 'Disabled'
          hostName: backendFqdn
          path: '/'
          pickHostNameFromBackendAddress: false
          port: 443
          probe: {
            id: gatewayProbeId
          }
          probeEnabled: true
          protocol: 'Https'
          requestTimeout: applicationGateway.backend.requestTimeoutSeconds
          sniName: backendFqdn
          validateCertChainAndExpiry: true
          validateSNI: true
        }
      }
    ]
    enableFips: applicationGateway.enableFips
    enableHttp2: true
    firewallPolicy: {
      id: wafPolicy.id
    }
    forceFirewallPolicyAssociation: true
    frontendIPConfigurations: [
      {
        name: 'public'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: {
            id: gatewayPublicIp.id
          }
        }
      }
    ]
    frontendPorts: [
      {
        name: 'https'
        properties: {
          port: 443
        }
      }
    ]
    gatewayIPConfigurations: [
      {
        name: 'application-gateway-subnet'
        properties: {
          subnet: {
            id: appGatewaySubnetId
          }
        }
      }
    ]
    globalConfiguration: {
      enableRequestBuffering: true
      enableResponseBuffering: true
    }
    httpListeners: [
      {
        name: 'public-https'
        properties: {
          frontendIPConfiguration: {
            id: gatewayFrontendIpId
          }
          frontendPort: {
            id: gatewayFrontendPortId
          }
          hostName: publicHost
          protocol: 'Https'
          requireServerNameIndication: true
          sslCertificate: {
            id: gatewaySslCertificateId
          }
        }
      }
    ]
    probes: [
      {
        name: 'ready-over-tls'
        properties: {
          host: backendFqdn
          interval: applicationGateway.probe.intervalSeconds
          match: {
            statusCodes: [
              '200-399'
            ]
          }
          path: '/health/ready'
          pickHostNameFromBackendHttpSettings: false
          port: 443
          protocol: 'Https'
          timeout: applicationGateway.probe.timeoutSeconds
          unhealthyThreshold: applicationGateway.probe.unhealthyThreshold
        }
      }
    ]
    requestRoutingRules: [
      {
        name: 'public-to-private'
        properties: {
          backendAddressPool: {
            id: gatewayBackendPoolId
          }
          backendHttpSettings: {
            id: gatewayBackendSettingsId
          }
          httpListener: {
            id: gatewayListenerId
          }
          priority: 100
          rewriteRuleSet: {
            id: gatewayRewriteRuleSetId
          }
          ruleType: 'Basic'
        }
      }
    ]
    rewriteRuleSets: [
      {
        name: 'trusted-forwarded-origin'
        properties: {
          rewriteRules: [
            {
              name: 'set-public-origin-and-clear-client-identity'
              ruleSequence: 100
              actionSet: {
                requestHeaderConfigurations: [
                  {
                    headerName: 'X-Forwarded-Host'
                    headerValue: publicHost
                  }
                  {
                    headerName: 'X-Forwarded-Proto'
                    headerValue: 'https'
                  }
                  {
                    headerName: 'X-MS-CLIENT-PRINCIPAL'
                    headerValue: ''
                  }
                  {
                    headerName: 'X-MS-CLIENT-PRINCIPAL-ID'
                    headerValue: ''
                  }
                  {
                    headerName: 'X-MS-CLIENT-PRINCIPAL-NAME'
                    headerValue: ''
                  }
                ]
                responseHeaderConfigurations: []
              }
            }
          ]
        }
      }
    ]
    sku: {
      name: applicationGateway.skuName
      tier: applicationGateway.skuTier
    }
    sslCertificates: [
      {
        name: 'public-tls'
        properties: {
          keyVaultSecretId: tlsCertificateVersionedUri
        }
      }
    ]
    sslPolicy: {
      policyName: applicationGateway.sslPolicyName
      policyType: 'Predefined'
    }
  }
}

resource gatewayDiagnostics 'Microsoft.Insights/diagnosticSettings@2016-09-01' = if (enableDiagnostics) {
  name: 'service'
  scope: gateway
  location: location
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

output applicationGatewayId string = gateway.id
output publicIpAddress string = gatewayPublicIp.properties.ipAddress
output publicUrl string = 'https://${publicHost}'
output backendTlsTarget string = 'https://${backendFqdn}:443'
