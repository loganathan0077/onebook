# OneBook Admin Panel

This is a standalone Vite web application for managing OneBook licenses, businesses, and devices.
It communicates exclusively via secure Supabase Edge Functions. It does not use direct database queries from the frontend, ensuring that RLS policies remain tight and no private keys (e.g. signing keys or service role keys) are ever exposed to the client.

## Bootstrap SUPER_ADMIN Procedure

To use the Admin Panel for the first time, you must manually create your first `SUPER_ADMIN` user directly in the Supabase backend. Do NOT create a public endpoint to do this.

1. **Create an Auth User:**
   Go to the Supabase Dashboard -> **Authentication** -> **Users** and create a new user (e.g., `admin@yourdomain.com`).

2. **Assign the SUPER_ADMIN Role:**
   Once the user is created, copy their `User UUID`.
   Go to the Supabase SQL Editor and run:
   ```sql
   INSERT INTO admin_roles (user_id, role)
   VALUES ('YOUR-USER-UUID-HERE', 'SUPER_ADMIN');
   ```

3. **Login:**
   You can now start the Admin Panel and login with the email and password you created in step 1.
   
## Development

Run `npm run dev` to start the local development server.

## Production

Run `npm run build` to create a production bundle in `dist/`.
You can host this static bundle anywhere (e.g. Vercel, Netlify, or Supabase Hosting).
