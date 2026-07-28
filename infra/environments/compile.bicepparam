using '../main.bicep'

param config = loadJsonContent('./compile.config.json')
param enableFoundry = false
param deploymentStage = 'application'
param imageDigest = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
param previousRevisionName = ''
param webRevisionSuffix = 'synthetic-compile'
