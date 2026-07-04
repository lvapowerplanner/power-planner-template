# invite-workspace-user

Workspace Administration V1 for LVA Power Planner.

This Edge Function handles workspace user administration securely using the Supabase service role key.

Supported actions:

- `invite_user`
- `change_role`
- `disable_user`
- `enable_user`
- `remove_user`

Deploy from the project root:

```bash
supabase functions deploy invite-workspace-user
```

Required secrets:

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
supabase secrets set SUPABASE_ANON_KEY=YOUR_ANON_KEY
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set SITE_URL=https://YOUR_WORKSPACE_HOST_OPTIONAL
```

`SITE_URL` is optional. If omitted, the function uses the workspace host as the invite redirect.
