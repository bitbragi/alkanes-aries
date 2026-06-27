---
title: Alkanes REST Endpoints
source: subfrost-api
source_url: https://api.subfrost.io/docs/rest/alkanes
---

# Alkanes REST Endpoints

Query alkane tokens, contracts, and holdings.

## get-alkanes

List all alkanes with pagination.

**Endpoint:** `POST /get-alkanes`

**Parameters:**

-   `limit` (number, optional) - Maximum results (default: 50)
-   `offset` (number, optional) - Pagination offset (default: 0)

POST /v4/api/get-alkanes

Run

List all alkane tokens with pagination.

limit:

offset:

Click "Run" to execute the request...

* * *

## get-alkane-details

Get detailed information about a specific alkane.

**Endpoint:** `POST /get-alkane-details`

**Parameters:**

-   `alkaneId` (object) - The alkane ID with `block` and `tx` fields

POST /v4/api/get-alkane-details

Run

Get details for a specific alkane token.

alkaneId:

Click "Run" to execute the request...

* * *

## global-alkanes-search

Search for alkanes and pools by name or symbol.

**Endpoint:** `POST /global-alkanes-search`

**Parameters:**

-   `searchQuery` (string) - Search query
-   `limit` (number, optional) - Maximum results
-   `offset` (number, optional) - Pagination offset

POST /v4/api/global-alkanes-search

Run

Search alkanes and pools by name or symbol.

searchQuery:

limit:

Click "Run" to execute the request...

* * *

## get-alkanes-utxo

Get alkane UTXOs for an address.

**Endpoint:** `POST /get-alkanes-utxo`

**Parameters:**

-   `address` (string) - Bitcoin address

POST /v4/api/get-alkanes-utxo

Run

Get alkane-containing UTXOs for an address.

address:

Click "Run" to execute the request...

* * *

## get-amm-utxos

Get AMM-related UTXOs for an address.

**Endpoint:** `POST /get-amm-utxos`

**Parameters:**

-   `address` (string) - Bitcoin address

POST /v4/api/get-amm-utxos

Run

Get AMM liquidity position UTXOs for an address.

address:

Click "Run" to execute the request...

* * *

## get-address-outpoints

Get outpoints containing alkanes for an address.

**Endpoint:** `POST /get-address-outpoints`

**Parameters:**

-   `address` (string) - Bitcoin address

POST /v4/api/get-address-outpoints

Run

Get all outpoints with alkane balances for an address.

address:

Click "Run" to execute the request...

* * *

## JavaScript Example

```javascript
class AlkanesClient {
  constructor(apiKey, network = 'mainnet') {
    this.baseUrl = `https://${network}.subfrost.io/v4/api`;
    this.apiKey = apiKey;
  }

  async post(endpoint, body = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-subfrost-api-key': this.apiKey
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (data.statusCode !== 200) throw new Error(data.error);
    return data.data;
  }

  async getAllAlkanes(limit = 50, offset = 0) {
    return this.post('/get-alkanes', { limit, offset });
  }

  async getAlkaneDetails(block, tx) {
    return this.post('/get-alkane-details', { 
      alkaneId: { block: String(block), tx: String(tx) }
    });
  }

  async searchAlkanes(query) {
    return this.post('/global-alkanes-search', { query });
  }
}

// Usage
const client = new AlkanesClient('your-api-key');

const alkanes = await client.getAllAlkanes(10, 0);
console.log('Alkanes:', alkanes);

const details = await client.getAlkaneDetails(4, 65522);
console.log('Details:', details);
```