using '../main.bicep'

param config = loadJsonContent('./production.config.json')
param enableFoundry = false
param deploymentStage = 'foundation'
param imageDigest = ''
param previousRevisionName = ''
param webRevisionSuffix = ''
