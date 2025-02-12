from datetime import datetime

from pydantic import BaseModel

from onyx.server.settings.models import GatingType


class CheckoutSessionCreationRequest(BaseModel):
    quantity: int


class CreateTenantRequest(BaseModel):
    tenant_id: str
    initial_admin_email: str


class ProductGatingRequest(BaseModel):
    tenant_id: str
    product_gating: GatingType


class BillingInformation(BaseModel):
    stripe_subscription_id: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    number_of_seats: int
    cancel_at_period_end: bool
    canceled_at: datetime | None
    trial_start: datetime | None
    trial_end: datetime | None
    seats: int
    payment_method_enabled: bool


class CheckoutSessionCreationResponse(BaseModel):
    id: str


class ImpersonateRequest(BaseModel):
    email: str


class TenantCreationPayload(BaseModel):
    tenant_id: str
    email: str
    referral_source: str | None = None


class TenantDeletionPayload(BaseModel):
    tenant_id: str
    email: str


class AnonymousUserPath(BaseModel):
    anonymous_user_path: str | None
