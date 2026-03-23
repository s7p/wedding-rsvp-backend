import { Hono } from "hono";
import { jwtVerify, createRemoteJWKSet } from "jose";

type Bindings = {
  RSVP_KV: KVNamespace;
  POLICY_AUD: string;
  TEAM_DOMAIN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware to validate Cloudflare Access JWT
app.use("/api/*", async (c, next) => {
  // Allow OPTIONS preflight requests (useful if accessed via CORS, though SPA should be on same domain)
  if (c.req.method === "OPTIONS") {
    return next();
  }

  if (!c.env.POLICY_AUD || !c.env.TEAM_DOMAIN) {
    console.error("Auth Error: Missing POLICY_AUD or TEAM_DOMAIN environment variables");
    return c.json({ error: "Missing required environment variables" }, 500);
  }

  const token = c.req.header("cf-access-jwt-assertion");
  if (!token) {
    console.error("Auth Error: Missing required CF Access JWT header");
    return c.json({ 
      error: "Missing required CF Access JWT",
      authUrl: c.env.TEAM_DOMAIN
    }, 403);
  }

  try {
    const JWKS = createRemoteJWKSet(new URL(`${c.env.TEAM_DOMAIN}/cdn-cgi/access/certs`));
    await jwtVerify(token, JWKS, {
      issuer: c.env.TEAM_DOMAIN,
      audience: c.env.POLICY_AUD,
    });
    // Token is valid
    await next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Auth Error: JWT validation failed - ${message}`);
    return c.json({ 
      error: `Invalid token: ${message}`,
      authUrl: c.env.TEAM_DOMAIN
    }, 403);
  }
});

app.get("/api/rsvps", async (c) => {
  try {
    const rsvps = [];
    let cursor: string | undefined = undefined;
    
    do {
      const listResult: KVNamespaceListResult<unknown, string> = await (c.env.RSVP_KV.list({ cursor }) as Promise<KVNamespaceListResult<unknown, string>>);
      
      const keys = listResult.keys;
      
      // Fetch values for all keys in parallel
      const values = await Promise.all(
        keys.map(async (key) => {
          const valueStr = await c.env.RSVP_KV.get(key.name);
          return valueStr ? JSON.parse(valueStr) : null;
        })
      );
      
      rsvps.push(...values.filter(v => v !== null));
      
      cursor = listResult.list_complete ? undefined : listResult.cursor;
    } while (cursor);
    
    // Sort RSVPs by submittedAt, descending (most recent first)
    rsvps.sort((a, b) => {
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return dateB - dateA;
    });
    
    return c.json({ success: true, count: rsvps.length, rsvps });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

export default app;
