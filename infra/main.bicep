targetScope = 'subscription'

@description('Complete deployment configuration. Production input is intentionally incomplete and must pass offline preflight before use.')
param config object

@description('Foundry remains disabled until the separate account, region, policy, and data-governance gates pass.')
param enableFoundry bool = false

@description('The explicitly reviewed deployment stage. Foundation creates prerequisites only, migration adds the private job, and application adds the inactive web revision and ingress.')
@allowed([
  'foundation'
  'migration'
  'application'
])
param deploymentStage string

@description('Immutable sha256 OCI manifest digest. It is required by migration and application stages and intentionally empty during foundation bootstrap.')
param imageDigest string

@description('Existing revision that must retain all traffic while an application candidate is staged. Empty only for first bootstrap.')
param previousRevisionName string = ''

@description('Deterministic suffix for the candidate application revision. Required for the application stage.')
param webRevisionSuffix string = ''

var deploymentAllowed = config.deploymentProfile == 'production'

resource environmentResourceGroup 'Microsoft.Resources/resourceGroups@2025-04-01' = if (deploymentAllowed) {
  name: config.names.resourceGroup
  location: config.primaryLocation
  tags: union(config.tags, {
    environment: config.environmentName
    workload: config.workloadName
  })
}

module platform './modules/platform.bicep' = if (deploymentAllowed) {
  name: 'platform-${config.environmentName}'
  scope: environmentResourceGroup
  params: {
    config: config
    enableAmpls: config.features.enableAmpls
    enableDiagnostics: config.features.enableDiagnostics
    enableFirewall: config.features.enableFirewall
    enableFoundry: enableFoundry && config.features.enableFoundry
    deploymentStage: deploymentStage
    imageDigest: imageDigest
    previousRevisionName: previousRevisionName
    webRevisionSuffix: webRevisionSuffix
  }
}

output deploymentStatus string = deploymentAllowed
  ? 'Production profile admitted to the deployment template; canonical production preflight is still mandatory.'
  : 'Compile-only profile emits no resource group or platform deployment and cannot provision resources.'
output resourceGroupName string = deploymentAllowed ? environmentResourceGroup!.name : ''
output publicApplicationUrl string = deploymentAllowed && deploymentStage == 'application'
  ? 'https://${config.dns.publicHost}'
  : ''
output privateAcrDeliveryRequirement string = deploymentAllowed
  ? platform!.outputs.privateAcrDeliveryRequirement
  : 'Compile-only profile has no registry or delivery path.'
output postProvisioningGates array = deploymentAllowed
  ? platform!.outputs.postProvisioningGates
  : [
      'Compile-only profile cannot provision resources.'
    ]
output foundryStatus string = deploymentAllowed
  ? platform!.outputs.foundryStatus
  : 'Compile-only profile has no Foundry boundary or effect.'
output monitoringPosture object = deploymentAllowed
  ? platform!.outputs.monitoringPosture
  : {
      status: 'compile-only-no-resources'
      runtimeExporterStatus: 'scaffolded-disabled'
    }
