"""
Etherfuse FX API client for MXN <-> crypto onramps and offramps.
Docs: https://docs.etherfuse.com/
Auth: Authorization: <api_key> — NO Bearer prefix.
"""
import uuid
import requests
from typing import Any, Optional

# Import app config lazily to avoid circular imports
def _get_config():
    from config import ETHERFUSE_API_KEY, ETHERFUSE_BASE_URL, ETHERFUSE_IS_SANDBOX
    return ETHERFUSE_API_KEY, ETHERFUSE_BASE_URL, ETHERFUSE_IS_SANDBOX


def _headers() -> dict:
    api_key, _, _ = _get_config()
    return {
        "Authorization": api_key,
        "Content-Type": "application/json",
    }


def _url(path: str) -> str:
    _, base, _ = _get_config()
    return f"{base.rstrip('/')}{path}"


def _normalize_identifier(raw: str, blockchain: str) -> str:
    """Convert tokenIdentifier (e.g. CETES-GC3...) to quote format CODE:ISSUER for Stellar."""
    if blockchain == "stellar" and "-" in raw and ":" not in raw:
        return raw.replace("-", ":", 1)
    return raw


# --- Lookup (public, no auth) ---

def get_stablebonds() -> dict:
    """GET /lookup/stablebonds — public, no auth. Returns available assets for quotes."""
    r = requests.get(_url("/lookup/stablebonds"), timeout=15)
    r.raise_for_status()
    return r.json()


def get_stellar_assets() -> list[dict]:
    """Stellar assets from stablebonds, in quote-ready format."""
    data = get_stablebonds()
    out = []
    for sb in data.get("stablebonds", []):
        for bc in sb.get("blockchains", []):
            if bc.get("blockchain") != "stellar":
                continue
            ident = bc.get("tokenIdentifier", "")
            if not ident:
                continue
            out.append({
                "symbol": sb.get("symbol"),
                "identifier": _normalize_identifier(ident, "stellar"),
                "tokenIdentifier": ident,
                "bondCurrency": sb.get("bondCurrency"),
                "tokenPriceDecimal": sb.get("tokenPriceDecimal"),
            })
    return out


# --- Onboarding ---

def generate_onboarding_url(
    customer_id: str,
    bank_account_id: str,
    public_key: str,
    blockchain: str = "stellar",
) -> dict:
    """POST /ramp/onboarding-url — generates presigned URL for hosted KYC + bank + wallet."""
    payload = {
        "customerId": customer_id,
        "bankAccountId": bank_account_id,
        "publicKey": public_key,
        "blockchain": blockchain,
    }
    r = requests.post(
        _url("/ramp/onboarding-url"),
        headers=_headers(),
        json=payload,
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


# --- Quotes ---

def create_quote(
    customer_id: str,
    blockchain: str,
    quote_type: str,  # "onramp" | "offramp"
    source_asset: str,
    target_asset: str,
    source_amount: str,
) -> dict:
    """POST /ramp/quote — quotes expire after 2 minutes."""
    quote_id = str(uuid.uuid4())
    payload = {
        "quoteId": quote_id,
        "customerId": customer_id,
        "blockchain": blockchain,
        "quoteAssets": {
            "type": quote_type,
            "sourceAsset": source_asset,
            "targetAsset": target_asset,
        },
        "sourceAmount": source_amount,
    }
    r = requests.post(
        _url("/ramp/quote"),
        headers=_headers(),
        json=payload,
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


# --- Orders ---

def create_order(
    order_id: str,
    bank_account_id: str,
    crypto_wallet_id: str,
    quote_id: str,
    use_anchor: bool = False,
) -> dict:
    """POST /ramp/order — create order from quote. Quote must not be expired."""
    payload = {
        "orderId": order_id,
        "bankAccountId": bank_account_id,
        "cryptoWalletId": crypto_wallet_id,
        "quoteId": quote_id,
    }
    if use_anchor:
        payload["useAnchor"] = True
    r = requests.post(
        _url("/ramp/order"),
        headers=_headers(),
        json=payload,
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def get_order(order_id: str) -> dict:
    """GET /ramp/order/{order_id}"""
    r = requests.get(
        _url(f"/ramp/order/{order_id}"),
        headers=_headers(),
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


# --- Sandbox only ---

def simulate_fiat_received(order_id: str) -> dict:
    """POST /ramp/order/fiat_received — sandbox only. Simulates MXN deposit for onramp."""
    _, _, is_sandbox = _get_config()
    if not is_sandbox:
        raise ValueError("simulate_fiat_received is only available in sandbox")
    r = requests.post(
        _url("/ramp/order/fiat_received"),
        headers=_headers(),
        json={"orderId": order_id},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


# --- Customer wallets (to get cryptoWalletId after onboarding) ---

def get_customer_wallets(customer_id: str) -> list:
    """GET /ramp/customer/{customer_id}/wallets — returns wallet IDs for orders."""
    r = requests.get(
        _url(f"/ramp/customer/{customer_id}/wallets"),
        headers=_headers(),
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    return data.get("items", [])


# --- KYC status ---

def get_kyc_status(customer_id: str, public_key: str) -> dict:
    """GET /ramp/customer/{id}/kyc/{pubkey}"""
    r = requests.get(
        _url(f"/ramp/customer/{customer_id}/kyc/{public_key}"),
        headers=_headers(),
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


# --- Rampable assets (auth required, wallet-specific) ---

def get_rampable_assets(
    customer_id: str,
    blockchain: str,
    currency: str = "MXN",
    public_key: Optional[str] = None,
) -> dict:
    """GET /ramp/assets — assets available for this customer/wallet."""
    params = {
        "customerId": customer_id,
        "blockchain": blockchain,
        "currency": currency,
    }
    if public_key:
        params["publicKey"] = public_key
    r = requests.get(
        _url("/ramp/assets"),
        headers=_headers(),
        params=params,
        timeout=15,
    )
    r.raise_for_status()
    return r.json()
