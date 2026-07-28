targetScope = 'resourceGroup'

param location string
param virtualNetworkId string
param privateEndpointSubnetId string
param dnsZoneNames array
param endpoints array
param tags object

resource privateDnsZones 'Microsoft.Network/privateDnsZones@2024-06-01' = [
  for zoneName in dnsZoneNames: {
    name: zoneName
    location: 'global'
    tags: tags
  }
]

resource virtualNetworkLinks 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = [
  for (zoneName, index) in dnsZoneNames: {
    parent: privateDnsZones[index]
    name: 'link-${uniqueString(virtualNetworkId, zoneName)}'
    location: 'global'
    tags: tags
    properties: {
      registrationEnabled: false
      virtualNetwork: {
        id: virtualNetworkId
      }
    }
  }
]

resource privateEndpoints 'Microsoft.Network/privateEndpoints@2025-07-01' = [
  for endpoint in endpoints: {
    name: endpoint.name
    location: location
    tags: tags
    properties: {
      customNetworkInterfaceName: '${endpoint.name}-nic'
      privateLinkServiceConnections: [
        {
          name: endpoint.name
          properties: {
            groupIds: endpoint.groupIds
            privateLinkServiceId: endpoint.targetResourceId
            requestMessage: 'Approved private data-plane connection.'
          }
        }
      ]
      subnet: {
        id: privateEndpointSubnetId
      }
    }
  }
]

resource privateDnsZoneGroups 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2025-07-01' = [
  for (endpoint, index) in endpoints: {
    parent: privateEndpoints[index]
    name: 'default'
    properties: {
      privateDnsZoneConfigs: [
        for zoneName in endpoint.dnsZoneNames: {
          name: replace(zoneName, '.', '-')
          properties: {
            privateDnsZoneId: resourceId('Microsoft.Network/privateDnsZones', zoneName)
          }
        }
      ]
    }
  }
]

output privateEndpointIds array = [for (endpoint, index) in endpoints: privateEndpoints[index].id]
