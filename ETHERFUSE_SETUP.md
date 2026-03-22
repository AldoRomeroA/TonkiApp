# Etherfuse Ramp Setup (MXN ↔ Crypto)

Etherfuse powers MXN ↔ crypto onramps and offramps for Tonki. See [Testing Onramps](https://docs.etherfuse.com/guides/testing-onramps) and [Testing Offramps](https://docs.etherfuse.com/guides/testing-offramps).

## 1. Get API Key

- **Sandbox**: [devnet.etherfuse.com](https://devnet.etherfuse.com/) → Ramp → API Keys
- **Production**: [app.etherfuse.com](https://app.etherfuse.com/ramp/manage-api)

## 2. Environment Variables

```bash
# Sandbox (default)
export ETHERFUSE_API_KEY="your-sandbox-api-key"
export ETHERFUSE_BASE_URL="https://api.sand.etherfuse.com"

# Production
export ETHERFUSE_API_KEY="your-production-api-key"
export ETHERFUSE_BASE_URL="https://api.etherfuse.com"
```

**Auth**: Use `Authorization: your-api-key` — **no** `Bearer` prefix.

## 3. Create Database Table

Run once to create the `EtherfuseProfile` table:

```bash
cd TonkiApp
python -c "
from app import app
from extensions import db
with app.app_context():
    db.create_all()
    print('Tables created.')
"
```

## 4. Flow

1. **Onboarding** (one-time per user): User clicks "Ir a verificación" → redirected to Etherfuse hosted KYC + bank + agreements. Returns to Tonki after completing.
2. **Onramp** (MXN → crypto): Quote → Order → Customer deposits MXN to CLABE → Crypto sent to wallet. In **sandbox**, use "Simular depósito" to simulate the fiat deposit.
3. **Offramp** (crypto → MXN): Quote → Order → Customer signs burn transaction on status page → MXN sent to bank account.

## 5. Stellar Asset Format

Quotes use `CODE:ISSUER` (e.g. `CETES:GCRYUGD5...`, `USDC:GA5ZSEJYB37...`). The UI loads assets from `GET /lookup/stablebonds` and falls back to common Stellar identifiers if the API is unavailable.

## 6. Gotchas (from stellar-ai-guide-mx)

- `customer_id` and `bankAccountId` are per end-user: **generate once, store, reuse forever** — never per session.
- A `G...` address can only be registered to one customer; re-registration fails even in sandbox.
- Sandbox orders don't progress automatically: POST to `/ramp/order/fiat_received` to simulate fiat.
- Quote TTL is 2 minutes — create a fresh quote if expired.
