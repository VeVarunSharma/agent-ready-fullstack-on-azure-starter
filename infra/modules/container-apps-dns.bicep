targetScope = 'resourceGroup'

param environmentDefaultDomain string
param environmentStaticIp string
param virtualNetworkId string
param tags object

resource environmentPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: environmentDefaultDomain
  location: 'global'
  tags: tags
}

resource environmentPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: environmentPrivateDnsZone
  name: 'link-${uniqueString(virtualNetworkId, environmentDefaultDomain)}'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetworkId
    }
  }
}

resource environmentWildcardRecord 'Microsoft.Network/privateDnsZones/A@2024-06-01' = {
  parent: environmentPrivateDnsZone
  name: '*'
  properties: {
    aRecords: [
      {
        ipv4Address: environmentStaticIp
      }
    ]
    ttl: 60
  }
}

output privateDnsZoneId string = environmentPrivateDnsZone.id
