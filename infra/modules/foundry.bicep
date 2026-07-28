targetScope = 'resourceGroup'

@description('This boundary is intentionally false-only until every Standard Agent Setup surface and generated data-plane role has supported GA automation.')
@allowed([
  false
])
param enableFoundry bool = false

output posture string = enableFoundry
  ? 'Blocked: this false-only parameter prevents deployment.'
  : 'Nondeployable Foundry boundary: no account, project, capability host, BYO store, private endpoint, DNS zone, RBAC assignment, model, or agent is declared.'
output blocker string = 'Generated capability-host Blob containers and the native Cosmos DB data-plane scope are unavailable before capability-host creation, so least-privilege Standard Agent Setup cannot be represented as an atomic GA-only deployment.'
