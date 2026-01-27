"""Stripe payment endpoints."""

import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import get_db, User, Subscription, SubscriptionStatus, UserTier
from app.api.v1.endpoints.auth import require_user

router = APIRouter(prefix="/stripe", tags=["Stripe"])

# Stripe configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID", "price_pro_monthly")
STRIPE_BUSINESS_PRICE_ID = os.getenv("STRIPE_BUSINESS_PRICE_ID", "price_business_monthly")

# Lazy import stripe
stripe = None

def get_stripe():
    global stripe
    if stripe is None:
        import stripe as stripe_module
        stripe_module.api_key = STRIPE_SECRET_KEY
        stripe = stripe_module
    return stripe


# ============== Request/Response Models ==============

class CreateCheckoutRequest(BaseModel):
    """Checkout session request."""
    price_id: str
    success_url: str
    cancel_url: str


class CheckoutResponse(BaseModel):
    """Checkout session response."""
    checkout_url: str
    session_id: str


class PortalResponse(BaseModel):
    """Customer portal response."""
    portal_url: str


# ============== Endpoints ==============

@router.post("/create-checkout", response_model=CheckoutResponse)
async def create_checkout_session(
    request: CreateCheckoutRequest,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe checkout session for subscription."""
    stripe = get_stripe()
    
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment system not configured",
        )
    
    # Get or create Stripe customer
    customer_id = None
    if user.subscription and user.subscription.stripe_customer_id:
        customer_id = user.subscription.stripe_customer_id
    else:
        # Create new customer
        customer = stripe.Customer.create(
            email=user.email,
            metadata={"user_id": user.id},
        )
        customer_id = customer.id
    
    # Determine plan from price_id
    plan = "pro"
    if request.price_id == STRIPE_BUSINESS_PRICE_ID:
        plan = "business"
    
    # Create checkout session
    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": request.price_id, "quantity": 1}],
        success_url=request.success_url,
        cancel_url=request.cancel_url,
        metadata={
            "user_id": user.id,
            "plan": plan,
        },
    )
    
    return CheckoutResponse(
        checkout_url=session.url,
        session_id=session.id,
    )


@router.post("/portal", response_model=PortalResponse)
async def create_customer_portal(
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe customer portal session."""
    stripe = get_stripe()
    
    if not user.subscription or not user.subscription.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No subscription found",
        )
    
    session = stripe.billing_portal.Session.create(
        customer=user.subscription.stripe_customer_id,
        return_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/profile",
    )
    
    return PortalResponse(portal_url=session.url)


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe webhook events."""
    stripe = get_stripe()
    
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle events
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        await handle_checkout_completed(session, db)
    
    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        await handle_subscription_updated(subscription, db)
    
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        await handle_subscription_deleted(subscription, db)
    
    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        await handle_payment_failed(invoice, db)
    
    return {"status": "ok"}


# ============== Webhook Handlers ==============

async def handle_checkout_completed(session: dict, db: AsyncSession):
    """Handle successful checkout."""
    user_id = session.get("metadata", {}).get("user_id")
    plan = session.get("metadata", {}).get("plan", "pro")
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")
    
    if not user_id:
        return
    
    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return
    
    # Update user tier
    user.tier = UserTier.PRO.value if plan == "pro" else UserTier.BUSINESS.value
    
    # Create or update subscription
    if user.subscription:
        user.subscription.plan = plan
        user.subscription.status = SubscriptionStatus.ACTIVE.value
        user.subscription.stripe_customer_id = customer_id
        user.subscription.stripe_subscription_id = subscription_id
    else:
        subscription = Subscription(
            user_id=user.id,
            plan=plan,
            status=SubscriptionStatus.ACTIVE.value,
            stripe_customer_id=customer_id,
            stripe_subscription_id=subscription_id,
            current_period_start=datetime.utcnow(),
        )
        db.add(subscription)
    
    await db.commit()


async def handle_subscription_updated(stripe_sub: dict, db: AsyncSession):
    """Handle subscription update."""
    subscription_id = stripe_sub.get("id")
    status = stripe_sub.get("status")
    
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
    )
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        return
    
    # Map Stripe status
    if status == "active":
        subscription.status = SubscriptionStatus.ACTIVE.value
    elif status == "past_due":
        subscription.status = SubscriptionStatus.PAST_DUE.value
    elif status in ["canceled", "unpaid"]:
        subscription.status = SubscriptionStatus.CANCELLED.value
    
    # Update period
    if stripe_sub.get("current_period_end"):
        subscription.current_period_end = datetime.fromtimestamp(
            stripe_sub["current_period_end"]
        )
    
    await db.commit()


async def handle_subscription_deleted(stripe_sub: dict, db: AsyncSession):
    """Handle subscription cancellation."""
    subscription_id = stripe_sub.get("id")
    
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
    )
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        return
    
    # Downgrade user to free
    result = await db.execute(select(User).where(User.id == subscription.user_id))
    user = result.scalar_one_or_none()
    
    if user:
        user.tier = UserTier.FREE.value
    
    subscription.status = SubscriptionStatus.CANCELLED.value
    subscription.cancelled_at = datetime.utcnow()
    
    await db.commit()


async def handle_payment_failed(invoice: dict, db: AsyncSession):
    """Handle failed payment."""
    subscription_id = invoice.get("subscription")
    
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
    )
    subscription = result.scalar_one_or_none()
    
    if subscription:
        subscription.status = SubscriptionStatus.PAST_DUE.value
        await db.commit()
