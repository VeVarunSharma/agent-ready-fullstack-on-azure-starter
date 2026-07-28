# Database bootstrap

Azure RBAC and Flexible Server Entra authentication do not create PostgreSQL roles. This one-time
runbook creates and verifies OID-bound principals for the application and migration managed
identities after an authorized server deployment.

> No Azure PostgreSQL server or principal exists. Do not run these steps against any environment
> without separate authorization, approved values, backup/recovery evidence, and a private network
> path.

## Identity and privilege model

| Identity                            | Azure purpose                                               | PostgreSQL purpose                                                      |
| ----------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Entra administrator group           | Bootstrap/recovery only                                     | Create Entra principals, grant/revoke, verify; not application runtime  |
| Application user-assigned identity  | ACR pull, approved Key Vault reads, database token          | Connect and perform only PRD-approved DML; no schema creation/ownership |
| Migration user-assigned identity    | ACR pull and manual migration job                           | Own/apply reviewed DDL and migration metadata; no app runtime           |
| Delivery what-if identity           | Read-only ARM planning                                      | No database login                                                       |
| Delivery infrastructure identity    | Reviewed ARM resource/RBAC deployment                       | No database login                                                       |
| Delivery registry identity          | Private ACR publication only                                | No database login                                                       |
| Delivery migration/runtime identity | Start/inspect the job, shift/restore traffic, query rollout | No database login; the job uses the migration identity                  |

Use groups for human administration. Do not grant broad Azure Owner or PostgreSQL superuser-like
duties to application/migration identities.

## Prerequisites

- Production preflight and same-run reviewed/fresh what-if evidence passed.
- Flexible Server exists in the approved region with public access/password auth disabled.
- The Entra administrator resource points to the approved administrator group.
- Private endpoint/DNS resolves from the authorized bootstrap runner.
- App and migration user-assigned identities exist; their immutable Entra object/principal IDs and
  approved PostgreSQL principal names are recorded.
- A restore/recovery plan and evidence-storage location are approved.
- The protected environment, four distinct delivery FICs/client IDs, least-privilege Azure RBAC, and
  isolated VNet-connected runner are externally approved and verified.
- The exact schema/grant contract is in a persistence-impact PRD. At bootstrap, the repository
  schema is empty and no application table grant is justified.
- Current Microsoft Flexible Server Entra principal syntax is rechecked before execution.

Do not use the client ID where PostgreSQL requires the managed identity object/principal ID.

## Gather values read-only

From an authorized VNet-connected operator/runner, retrieve values from reviewed deployment outputs
or read-only CLI queries. Never copy them into source:

```sh
export RESOURCE_GROUP="<approved-resource-group>"
export APP_IDENTITY_NAME="<approved-app-identity-name>"
export MIGRATION_IDENTITY_NAME="<approved-migration-identity-name>"

APP_OBJECT_ID="$(
  az identity show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_IDENTITY_NAME" \
    --query principalId \
    --output tsv
)"
MIGRATION_OBJECT_ID="$(
  az identity show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$MIGRATION_IDENTITY_NAME" \
    --query principalId \
    --output tsv
)"
```

Fail if a query is empty or differs from reviewed IaC evidence. Do not print tokens or complete
environment dumps.

## Connect as the Entra administrator

Acquire a short-lived token for Azure OSS RDBMS and pass it to `psql` only in process environment:

```sh
export PGHOST="<private-postgres-fqdn>"
export PGPORT="5432"
export PGDATABASE="<approved-database>"
export PGUSER="<approved-entra-admin-principal>"
export PGSSLMODE="verify-full"
export PGPASSWORD="$(
  az account get-access-token \
    --resource-type oss-rdbms \
    --query accessToken \
    --output tsv
)"

psql --no-psqlrc --set=ON_ERROR_STOP=1
unset PGPASSWORD
```

The current database client uses system trust with `rejectUnauthorized`; production operator images
must include an approved CA bundle. Do not switch to `sslmode=require` or disable certificate
verification to bypass trust failures.

## Inspect before creating

In `psql`, set reviewed values:

```sql
\set app_name '<approved-app-principal-name>'
\set app_oid '<app-managed-identity-object-id>'
\set migration_name '<approved-migration-principal-name>'
\set migration_oid '<migration-managed-identity-object-id>'
\set db_name '<approved-database>'

SELECT current_user, current_database();

SELECT rolname
FROM pg_catalog.pg_roles
WHERE rolname IN (:'app_name', :'migration_name');
```

If a name exists, verify its Entra object mapping using the current Azure PostgreSQL
catalog/functions before proceeding. A same-name role is not proof of the correct object. Stop on an
unexpected mapping; do not drop/recreate it casually.

## Create OID-bound service principals

After verifying the current supported function signature:

```sql
SELECT *
FROM pgaadauth_create_principal_with_oid(
  :'app_name',
  :'app_oid',
  'service',
  false,
  false
);

SELECT *
FROM pgaadauth_create_principal_with_oid(
  :'migration_name',
  :'migration_oid',
  'service',
  false,
  false
);
```

Use the OID-explicit function so duplicate display names cannot bind the wrong service principal.
Treat “already exists” as a verification branch, not permission to ignore identity mismatch.

## Baseline grants

With the current empty schema, grant connection and migration capability only:

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT CONNECT ON DATABASE :"db_name" TO :"app_name";
GRANT CONNECT ON DATABASE :"db_name" TO :"migration_name";

GRANT USAGE ON SCHEMA public TO :"app_name";
GRANT USAGE, CREATE ON SCHEMA public TO :"migration_name";

CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION :"migration_name";
REVOKE ALL ON SCHEMA drizzle FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA drizzle TO :"migration_name";
```

If `drizzle` already exists, verify its owner before changing grants; `IF NOT EXISTS` does not
correct an unexpected owner. The application identity receives no access to migration metadata.

If the approved design uses a dedicated schema, create/own it through the migration identity instead
of expanding `public`. The first table-bearing migration must add explicit least-privilege grants. A
typical contract, adjusted to the approved operations, is:

```sql
\set app_schema '<approved-application-schema>'

GRANT USAGE ON SCHEMA :"app_schema" TO :"app_name";
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA :"app_schema"
  TO :"app_name";
GRANT USAGE, SELECT, UPDATE
  ON ALL SEQUENCES IN SCHEMA :"app_schema"
  TO :"app_name";

ALTER DEFAULT PRIVILEGES
  FOR ROLE :"migration_name"
  IN SCHEMA :"app_schema"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_name";
ALTER DEFAULT PRIVILEGES
  FOR ROLE :"migration_name"
  IN SCHEMA :"app_schema"
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"app_name";
```

Do not execute template grants before the schema and operations are approved. Avoid `GRANT ALL`,
database ownership, role admin, replication, bypass-RLS, or broad `PUBLIC` grants. Future row-level
security does not replace server-side authorization.

## Verify grants as administrator

```sql
SELECT
  rolname,
  rolsuper,
  rolcreaterole,
  rolcreatedb,
  rolreplication,
  rolbypassrls
FROM pg_catalog.pg_roles
WHERE rolname IN (:'app_name', :'migration_name');

SELECT
  has_database_privilege(:'app_name', :'db_name', 'CONNECT') AS app_connect,
  has_database_privilege(:'app_name', :'db_name', 'CREATE') AS app_create_database_object,
  has_database_privilege(:'migration_name', :'db_name', 'CONNECT') AS migration_connect;

SELECT
  has_schema_privilege(:'app_name', 'public', 'USAGE') AS app_public_usage,
  has_schema_privilege(:'app_name', 'public', 'CREATE') AS app_public_create,
  has_schema_privilege(:'migration_name', 'public', 'CREATE') AS migration_public_create;
```

Expected baseline:

- both identities can connect;
- neither is superuser, role/database creator, replication, or bypass-RLS;
- app can use but cannot create in the approved schema;
- migration can create only in `public`, `drizzle`, or a later explicitly approved application
  schema.

Inspect `information_schema.role_table_grants`, sequence privileges, schema owners, and default
privileges after the first schema migration. Record names and booleans, not tokens or row data.

## Verify each managed identity

An administrator query is insufficient. From the actual private Container Apps identity context:

1. obtain a token for `https://ossrdbms-aad.database.windows.net/.default` through the assigned
   user-managed identity;
2. connect with the exact PostgreSQL principal name and `verify-full`;
3. run `SELECT current_user, current_database()` and an approved harmless query;
4. prove the app identity cannot `CREATE TABLE`, alter schema, read migration-only objects, or
   assume the migration role;
5. prove the migration identity can read/apply migration metadata and the app cannot;
6. verify token refresh with a new connection without exposing token values.

The image deliberately has no Entra-administrator SQL bootstrap or general identity-diagnostic
command. The bundled production migration entrypoint is not an administrator bootstrap tool. Use a
separately approved private operator image/process for these positive/negative grant checks; do not
add `psql`, a shell, or admin capability to the lean runtime image merely for convenience.

## Migration execution

The production path is implemented but undeployed:

- `packages/db/src/migrate-production.ts` is bundled by esbuild to
  `packages/db/dist/migrate-production.mjs`;
- the image copies that bundle to `/app/migration/dist/migrate-production.mjs` and copies generated
  migrations to `/app/migration/migrations`;
- the manual private Container Apps Job runs `node migration/dist/migrate-production.mjs` from the
  same digest-pinned application image;
- configuration is accepted only for `RUNTIME_MODE=production` and
  `DATABASE_MODE=azure-managed-identity`; password mode and `DATABASE_URL` are not production
  fallbacks;
- the entrypoint uses a max-one migration pool with a 30-second connection budget, the refreshable
  managed-identity password callback, and certificate-verifying TLS; it does not inherit the
  readiness probe's query or statement timeout;
- it checks `pg_try_advisory_lock` on one dedicated `PoolClient`, runs Drizzle on that same
  PostgreSQL session, releases the advisory lock in `finally`, releases the client, and closes the
  pool;
- lock contention fails closed instead of waiting for or overlapping another migration, and process
  output exposes only a bounded success/failure message.

The staged workflow deploys only the digest-pinned job after reviewed migration what-if evidence,
verifies its command/environment/workload identity, refuses an active or ambiguous prior execution,
starts one run, and requires `Succeeded` evidence before application planning. The database lock is
a second fail-closed concurrency boundary; it does not replace workflow serialization.

Before first authorized use, review generated SQL, set any statement/lock timeouts and retry
behavior explicitly for that migration rather than borrowing the readiness budget, prove PostgreSQL
principals/grants from actual workload identities, approve redacted evidence retention, and confirm
expand/migrate/contract compatibility.

Never run migration from install, Next.js build, image build, web startup, or a public runner.

## Failure and recovery

- Principal creation failure: stop; verify Entra admin, private DNS, object ID/type, and extension
  support. Do not enable password auth.
- Wrong OID mapping: revoke access and investigate; do not delete a production role until ownership
  and dependencies are understood.
- Grant failure: roll back only grants from the current reviewed transaction where safe; preserve
  evidence and do not grant broader privileges as a workaround.
- Advisory lock unavailable: stop; identify the other approved session/execution. Do not change the
  lock key, disable the check, or terminate an unknown session to force progress.
- Migration failure: stop rollout, preserve backward-compatible app/schema state, repair forward, or
  invoke the separately approved restore plan.
- Identity compromise: disable/revoke the managed identity assignment and SQL principal access,
  investigate tokens/logs, then re-bootstrap a replacement identity through IaC and reviewed SQL.

## No portal or ad hoc SQL drift

The Entra administrator, identities, network, and Azure RBAC remain in Bicep/reviewed identity
automation. SQL principal/grant statements must be versioned with the admitting persistence change
or captured as immutable approved execution evidence. Portal query editors and undocumented manual
grants are prohibited. Emergency SQL requires an incident, approver, exact statement/evidence,
expiry, and reconciliation.
