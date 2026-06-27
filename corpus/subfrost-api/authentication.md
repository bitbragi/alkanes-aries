---
title: Authentication
source: subfrost-api
source_url: https://api.subfrost.io/docs/authentication
---

# Authentication

Subfrost supports multiple authentication methods to suit different use cases.

## Authentication Methods

### 1\. API Key in Path

The simplest method - include your API key directly in the URL path:

```
https://mainnet.subfrost.io/v4/<your-api-key>
```

Example:

```bash
curl -X POST https://mainnet.subfrost.io/v4/a1b2c3d4e5f67890a1b2c3d4e5f67890 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"btc_getblockcount","params":[],"id":1}'
```

### 2\. API Key Header

Use the `x-subfrost-api-key` header for cleaner URLs:

```bash
curl -X POST https://mainnet.subfrost.io/v4/jsonrpc \
  -H "Content-Type: application/json" \
  -H "x-subfrost-api-key: a1b2c3d4e5f67890a1b2c3d4e5f67890" \
  -d '{"jsonrpc":"2.0","method":"btc_getblockcount","params":[],"id":1}'
```

### 3\. CORS-based Authentication

For browser-based applications, register your domain in the dashboard and make requests directly:

```javascript
// From your registered domain (e.g., https://yourapp.com)
const response = await fetch('https://mainnet.subfrost.io/v4/jsonrpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'btc_getblockcount',
    params: [],
    id: 1
  })
});
```

The API will verify the `Origin` header against your registered domains.

### 4\. Alias Routes

Create custom endpoint aliases for your applications:

```
https://api.subfrost.io/v4/<your-alias>
```

Aliases are configured in your dashboard and can be associated with specific rate limits and permissions.

## Endpoint Paths

-   **`/v4/<apikey>`** - Authenticate with API key in path
-   **`/v4/jsonrpc`** - Use with header authentication
-   **`/v4/api`** - Use with CORS authentication
-   **`/v4/<alias>`** - Use with custom alias

## Getting an API Key

1.  Sign up or log in at [api.subfrost.io](https://api.subfrost.io)
2.  Navigate to your Dashboard
3.  Click "Create API Key"
4.  Copy and securely store your key

> **Security Note**: API keys grant access to your account's resources. Never expose them in client-side code or public repositories.

## Managing CORS Domains

1.  Go to the Domains page in your dashboard
2.  Add your application's domain (e.g., `https://myapp.com`)
3.  Verify domain ownership if required
4.  Once verified, requests from that origin will be authenticated automatically

## Best Practices

### Server-side Applications

-   Store API keys in environment variables
-   Use the header method for cleaner logs
-   Rotate keys periodically

```javascript
// Node.js example
const API_KEY = process.env.SUBFROST_API_KEY;

const response = await fetch('https://mainnet.subfrost.io/v4/jsonrpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-subfrost-api-key': API_KEY
  },
  body: JSON.stringify({ /* ... */ })
});
```

### Client-side Applications

-   Use CORS authentication instead of embedding API keys
-   Register only your production domains
-   Consider using a backend proxy for additional security

### Rate Limiting

Different plans have different rate limits:

-   **Free** - 60 requests/minute, 1,000 requests/day
-   **Pro** - 600 requests/minute, 50,000 requests/day
-   **Business** - Unlimited

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1699123456
```

## Next Steps

-   [API Platform Overview](/docs/platform/overview) - Manage your account
-   [JSON-RPC Methods](/docs/jsonrpc/overview) - Start making requests