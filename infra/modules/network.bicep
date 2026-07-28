targetScope = 'resourceGroup'

param location string
param names object
param network object
param firewall object
param tags object
param enableFirewall bool = false

resource appGatewayNsg 'Microsoft.Network/networkSecurityGroups@2025-07-01' = {
  name: names.appGatewayNetworkSecurityGroup
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowHttpsFromInternet'
        properties: {
          access: 'Allow'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
          direction: 'Inbound'
          priority: 100
          protocol: 'Tcp'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
        }
      }
      {
        name: 'AllowGatewayManager'
        properties: {
          access: 'Allow'
          destinationAddressPrefix: '*'
          destinationPortRange: '65200-65535'
          direction: 'Inbound'
          priority: 110
          protocol: 'Tcp'
          sourceAddressPrefix: 'GatewayManager'
          sourcePortRange: '*'
        }
      }
      {
        name: 'AllowAzureLoadBalancer'
        properties: {
          access: 'Allow'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
          direction: 'Inbound'
          priority: 120
          protocol: '*'
          sourceAddressPrefix: 'AzureLoadBalancer'
          sourcePortRange: '*'
        }
      }
    ]
  }
}

resource privateEndpointNsg 'Microsoft.Network/networkSecurityGroups@2025-07-01' = {
  name: names.privateEndpointNetworkSecurityGroup
  location: location
  tags: tags
  properties: {
    securityRules: []
  }
}

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2025-07-01' = {
  name: names.virtualNetwork
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: network.vnetAddressPrefixes
    }
    dhcpOptions: {
      dnsServers: network.dnsServers
    }
  }
}

resource appGatewaySubnet 'Microsoft.Network/virtualNetworks/subnets@2025-07-01' = {
  parent: virtualNetwork
  name: names.appGatewaySubnet
  properties: {
    addressPrefix: network.subnets.applicationGateway
    networkSecurityGroup: {
      id: appGatewayNsg.id
    }
    privateEndpointNetworkPolicies: 'Enabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2025-07-01' = {
  parent: virtualNetwork
  name: names.privateEndpointSubnet
  properties: {
    addressPrefix: network.subnets.privateEndpoints
    networkSecurityGroup: {
      id: privateEndpointNsg.id
    }
    privateEndpointNetworkPolicies: 'Disabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

resource firewallSubnet 'Microsoft.Network/virtualNetworks/subnets@2025-07-01' = {
  parent: virtualNetwork
  name: names.firewallSubnet
  properties: {
    addressPrefix: network.subnets.firewall
    privateEndpointNetworkPolicies: 'Enabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

resource firewallPublicIp 'Microsoft.Network/publicIPAddresses@2025-07-01' = if (enableFirewall) {
  name: names.firewallPublicIp
  location: location
  zones: firewall.zones
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  tags: tags
  properties: {
    idleTimeoutInMinutes: 4
    publicIPAddressVersion: 'IPv4'
    publicIPAllocationMethod: 'Static'
  }
}

resource firewallPolicy 'Microsoft.Network/firewallPolicies@2025-07-01' = if (enableFirewall) {
  name: names.firewallPolicy
  location: location
  tags: tags
  properties: {
    dnsSettings: {
      enableProxy: true
    }
    sku: {
      tier: firewall.skuTier
    }
    threatIntelMode: 'Deny'
  }
}

resource azureFirewall 'Microsoft.Network/azureFirewalls@2025-07-01' = if (enableFirewall) {
  name: names.firewall
  location: location
  zones: firewall.zones
  tags: tags
  properties: {
    firewallPolicy: {
      id: firewallPolicy.id
    }
    ipConfigurations: [
      {
        name: 'primary'
        properties: {
          publicIPAddress: {
            id: firewallPublicIp.id
          }
          subnet: {
            id: firewallSubnet.id
          }
        }
      }
    ]
    sku: {
      name: 'AZFW_VNet'
      tier: firewall.skuTier
    }
    threatIntelMode: 'Deny'
  }
}

resource approvedEgressRules 'Microsoft.Network/firewallPolicies/ruleCollectionGroups@2025-07-01' = if (enableFirewall) {
  parent: firewallPolicy
  name: names.firewallRuleCollectionGroup
  properties: {
    priority: 100
    ruleCollections: [
      {
        name: 'approved-https-egress'
        action: {
          type: 'Allow'
        }
        priority: 100
        ruleCollectionType: 'FirewallPolicyFilterRuleCollection'
        rules: [
          {
            name: 'approved-fqdns'
            description: 'Explicitly approved HTTPS destinations only.'
            protocols: [
              {
                port: 443
                protocolType: 'Https'
              }
            ]
            ruleType: 'ApplicationRule'
            sourceAddresses: network.vnetAddressPrefixes
            targetFqdns: firewall.allowedFqdns
            terminateTLS: false
          }
        ]
      }
    ]
  }
}

resource workloadRouteTable 'Microsoft.Network/routeTables@2025-07-01' = if (enableFirewall) {
  name: names.workloadRouteTable
  location: location
  tags: tags
  properties: {
    disableBgpRoutePropagation: false
    routes: [
      {
        name: 'default-through-firewall'
        properties: {
          addressPrefix: '0.0.0.0/0'
          nextHopIpAddress: azureFirewall!.properties.ipConfigurations[0].properties.privateIPAddress
          nextHopType: 'VirtualAppliance'
        }
      }
    ]
  }
}

resource containerAppsSubnet 'Microsoft.Network/virtualNetworks/subnets@2025-07-01' = {
  parent: virtualNetwork
  name: names.containerAppsSubnet
  properties: {
    addressPrefix: network.subnets.containerApps
    delegations: [
      {
        name: 'container-apps-environment'
        properties: {
          serviceName: 'Microsoft.App/environments'
        }
      }
    ]
    privateEndpointNetworkPolicies: 'Enabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
    routeTable: enableFirewall
      ? {
          id: workloadRouteTable.id
        }
      : null
  }
}

output virtualNetworkId string = virtualNetwork.id
output appGatewaySubnetId string = appGatewaySubnet.id
output containerAppsSubnetId string = containerAppsSubnet.id
output privateEndpointSubnetId string = privateEndpointSubnet.id
output firewallSubnetId string = firewallSubnet.id
output egressStatus string = enableFirewall
  ? 'Azure Firewall is enabled with explicit FQDN allow rules and forced workload routes.'
  : 'Azure Firewall is disabled; the subnet and routing boundary are reserved, and production preflight must reject unresolved egress.'
