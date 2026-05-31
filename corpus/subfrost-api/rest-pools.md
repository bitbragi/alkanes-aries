---
title: Pools & AMM REST Endpoints
source: subfrost-api
source_url: https://api.subfrost.io/docs/rest/pools
---

# Pools & AMM REST Endpoints

Query and interact with alkanes AMM liquidity pools.

## get-pools

List all liquidity pools for a factory.

**Endpoint:** `POST /get-pools`

**Parameters:**

-   `factoryId` (object) - Factory ID with `block` and `tx` fields

POST /v4/api/get-pools

Run

List all pools for the specified factory.

factoryId:

Click "Run" to execute the request...

* * *

## get-all-pools-details

Get detailed information for all pools.

**Endpoint:** `POST /get-all-pools-details`

**Parameters:**

-   `factoryId` (object) - Factory ID with `block` and `tx` fields

POST /v4/api/get-all-pools-details

Run

Get details for all pools including reserves and token info.

factoryId:

Click "Run" to execute the request...

* * *

## get-pool-details

Get detailed information about a specific pool.

**Endpoint:** `POST /get-pool-details`

**Parameters:**

-   `factoryId` (object) - Factory ID with `block` and `tx` fields
-   `poolId` (object) - Pool ID with `block` and `tx` fields

POST /v4/api/get-pool-details

Run

Get details for a specific pool.

factoryId:

poolId:

Click "Run" to execute the request...

* * *

## get-all-token-pairs

Get all available token pairs.

**Endpoint:** `POST /get-all-token-pairs`

**Parameters:**

-   `factoryId` (object) - Factory ID with `block` and `tx` fields

POST /v4/api/get-all-token-pairs

Run

Get all token pairs available in the factory.

factoryId:

Click "Run" to execute the request...

* * *

## get-token-pairs

Get pairs containing a specific token.

**Endpoint:** `POST /get-token-pairs`

**Parameters:**

-   `factoryId` (object) - Factory ID with `block` and `tx` fields
-   `alkaneId` (object) - Token ID with `block` and `tx` fields

POST /v4/api/get-token-pairs

Run

Get all pairs that include the specified token.

factoryId:

alkaneId:

Click "Run" to execute the request...

* * *

## address-positions

Get liquidity positions for an address.

**Endpoint:** `POST /address-positions`

**Parameters:**

-   `factoryId` (object) - Factory ID with `block` and `tx` fields
-   `address` (string) - Bitcoin address

POST /v4/api/address-positions

Run

Get all liquidity positions for an address.

factoryId:

address:

Click "Run" to execute the request...

* * *

## get-alkane-swap-pair-details

Get swap pair details for a specific alkane token.

**Endpoint:** `POST /get-alkane-swap-pair-details`

**Parameters:**

-   `tokenId` (object) - Token ID with `block` and `tx` fields
-   `factoryId` (object) - Factory ID with `block` and `tx` fields
-   `page` (number, optional) - Page number
-   `limit` (number, optional) - Maximum results

POST /v4/api/get-alkane-swap-pair-details

Run

Get swap pair details for a specific token.

tokenId:

factoryId:

limit:

Click "Run" to execute the request...

* * *

## JavaScript Example

```javascript
class AMMClient {
  constructor(apiKey, network = 'mainnet') {
    this.baseUrl = `https://${network}.subfrost.io/v4/api`;
    this.apiKey = apiKey;
    this.factoryId = { block: "4", tx: "65522" };
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
    return (await response.json()).data;
  }

  async getAllPools() {
    return this.post('/get-all-pools-details', { 
      factoryId: this.factoryId 
    });
  }

  async getPoolDetails(poolBlock, poolTx) {
    return this.post('/get-pool-details', { 
      factoryId: this.factoryId,
      poolId: { block: String(poolBlock), tx: String(poolTx) }
    });
  }

  async getPositions(address) {
    return this.post('/address-positions', { 
      factoryId: this.factoryId,
      address 
    });
  }
}

// Usage
const amm = new AMMClient('your-api-key');

const { pools } = await amm.getAllPools();
console.log(`Found ${pools.length} pools`);

const positions = await amm.getPositions('bc1p...');
console.log('LP positions:', positions);
```