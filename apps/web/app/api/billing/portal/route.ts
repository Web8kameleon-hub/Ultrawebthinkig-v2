import { currentUser } from "@clerk/nextjs/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import Stripe from "stripe";

export async function POST(request: Request) {
  try {
    if (
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.includes("YOUR_")
    ) {
      return apiError("STRIPE_NOT_CONFIGURED", "Stripe billing portal is not configured", {
        status: 503,
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {});
    const body = await request.json().catch(() => ({}));
    const user = await currentUser();
    if (!user) {
      return apiError("UNAUTHORIZED", "Authentication required", {
        status: 401,
      });
    }

    const customerEmail = user.emailAddresses?.[0]?.emailAddress;
    if (!customerEmail) {
      return apiError("USER_EMAIL_MISSING", "User email is required", {
        status: 400,
      });
    }

    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return apiError("CUSTOMER_NOT_FOUND", "No Stripe customer was found for this account", {
        status: 404,
        details: { customerEmail },
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url:
        body.returnUrl ||
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/modules/account`,
    });

    return apiSuccess({
      url: session.url,
      customerId: customers.data[0].id,
    });
  } catch (error: unknown) {
    return apiError("BILLING_PORTAL_ERROR", "Failed to create billing portal session", {
      status: 500,
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
