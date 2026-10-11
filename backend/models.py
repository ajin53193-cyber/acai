"""Pydantic request models shared across the backend API."""
from pydantic import BaseModel, EmailStr
from typing import List, Optional


class LoginInput(BaseModel):
    email: EmailStr
    password: str
    code: Optional[str] = None


class AccountCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # agent | merchant | operator
    rate: float = 0.03
    parent_agent_id: Optional[str] = None
    permissions: Optional[List[str]] = None


class PermissionsUpdate(BaseModel):
    permissions: List[str]


class BalanceAdjust(BaseModel):
    amount: float
    action: str  # credit | debit | freeze | unfreeze
    remark: Optional[str] = ""


class SecurityPolicy(BaseModel):
    enforce_admin_2fa: bool = False
    enforce_operator_2fa: bool = False
    login_alert: bool = True


class CheckoutSettings(BaseModel):
    energy_enabled: bool = False
    energy_trx_address: str = ""
    energy_price_text: str = ""
    energy_amounts: str = "2,4"
    support_url: str = ""
    tutorial_links: List[dict] = []
    energy_rules: List[dict] = []
    logo_url: str = ""
    brand_subtitle: str = ""
    brand_subtitle_tw: str = ""
    brand_subtitle_en: str = ""
    theme_color: str = "#26A17B"



class ChannelCreate(BaseModel):
    name: str
    network: str
    fee_rate: float = 0.02
    weight: int = 10
    min_amount: float = 10
    max_amount: float = 50000
    status: str = "active"
    wallet_address: Optional[str] = ""
    wallet_addresses: Optional[List[str]] = None


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    fee_rate: Optional[float] = None
    weight: Optional[int] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    status: Optional[str] = None
    wallet_address: Optional[str] = None
    wallet_addresses: Optional[List[str]] = None


class OrderCreate(BaseModel):
    amount_usdt: float
    network: Optional[str] = None
    merchant_id: Optional[str] = None  # admin/agent may specify
    remark: Optional[str] = ""
    notify_url: Optional[str] = None
    out_trade_no: Optional[str] = None
    return_url: Optional[str] = None


class ApiOrderCreate(BaseModel):
    api_key: str
    timestamp: int
    nonce: str
    sign: str
    amount_usdt: float
    network: Optional[str] = "TRC20"
    out_trade_no: str
    notify_url: Optional[str] = None
    return_url: Optional[str] = None
    remark: Optional[str] = ""


class ApiOrderQuery(BaseModel):
    api_key: str
    timestamp: int
    nonce: str
    sign: str
    order_no: Optional[str] = None
    out_trade_no: Optional[str] = None


class DevTestOrder(BaseModel):
    merchant_id: str
    amount_usdt: float
    network: Optional[str] = "TRC20"
    out_trade_no: Optional[str] = None
    remark: Optional[str] = ""
    notify_url: Optional[str] = None
    return_url: Optional[str] = None


class NotifySettings(BaseModel):
    notify_url: Optional[str] = ""


class IpWhitelist(BaseModel):
    ips: List[str]
