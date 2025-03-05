# Tenant Provisioning Process

This directory contains the code for provisioning tenants in a multi-tenant Onyx deployment.

## Optimized Tenant Provisioning

The tenant provisioning process has been optimized to allow for faster authentication flow completion. The process is now split into two phases:

1. **Essential Setup (Synchronous)**

   - Create the tenant schema
   - Run essential Alembic migrations up to revision `465f78d9b7f9` (which includes OAuth access token changes)
   - Add the user to the tenant mapping
   - This allows the user to log in immediately without waiting for the full setup to complete

2. **Complete Setup (Asynchronous)**
   - Run the remaining Alembic migrations
   - Configure default API keys
   - Set up Onyx (embedding models, search settings, etc.)
   - Create milestone records
   - This happens in the background after the user has already been able to log in

## Key Files

- `provisioning.py`: Contains the main tenant provisioning logic
- `schema_management.py`: Handles schema creation and Alembic migrations
- `async_setup.py`: Handles the asynchronous part of the tenant setup
- `user_mapping.py`: Manages user-tenant mappings

## Flow

1. User initiates login/signup
2. `provision_tenant()` is called
3. Essential migrations are run with `run_essential_alembic_migrations()`
4. User is added to tenant mapping
5. Asynchronous task is started with `complete_tenant_setup()`
6. User can log in while the rest of the setup continues in the background

## Performance Impact

This optimization significantly reduces the time required for a user to log in after tenant creation. The most time-consuming operations (full migrations, Onyx setup) are deferred to run asynchronously, allowing the auth flow to complete quickly.
