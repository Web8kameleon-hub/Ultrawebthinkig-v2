/**
 * Clisonix Cloud - Clerk Webhook Handler
 *
 * Handles all Clerk webhook events for user authentication lifecycle
 *
 * @author Ledjan Ahmati
 * @copyright 2026 Clisonix Cloud
 */

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET || "";

export async function POST(request: NextRequest) {
  // Clerk webhook events we handle
  if (!webhookSecret) {
    console.warn("⚠️ CLERK_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") || "",
    "svix-timestamp": request.headers.get("svix-timestamp") || "",
    "svix-signature": request.headers.get("svix-signature") || "",
  };

  let event: any;

  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, headers) as any;
  } catch (err) {
    console.error("⚠️ Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const eventType = event.type;

    switch (eventType) {
      case "user.created": {
        await handleUserCreated(event.data);
        break;
      }

      case "user.updated": {
        await handleUserUpdated(event.data);
        break;
      }

      case "user.deleted": {
        await handleUserDeleted(event.data);
        break;
      }

      case "session.created": {
        await handleSessionCreated(event.data);
        break;
      }

      case "session.ended": {
        await handleSessionEnded(event.data);
        break;
      }

      case "email_address.created": {
        await handleEmailCreated(event.data);
        break;
      }

      case "email_address.verified": {
        await handleEmailVerified(event.data);
        break;
      }

      default:
        console.log(`Unhandled Clerk event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Clerk webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle user creation event
 * Triggered when a new user is created in Clerk
 */
async function handleUserCreated(user: any) {
  console.log(`✓ User created: ${user.id} (${user.email_addresses[0]?.email_address})`);

  // TODO: Sync user to your database
  // Example:
  // await db.users.create({
  //   clerkId: user.id,
  //   email: user.email_addresses[0]?.email_address,
  //   firstName: user.first_name,
  //   lastName: user.last_name,
  // });
}

/**
 * Handle user update event
 * Triggered when user profile is updated
 */
async function handleUserUpdated(user: any) {
  console.log(`✓ User updated: ${user.id}`);

  // TODO: Update user in your database
  // Example:
  // await db.users.update(
  //   { clerkId: user.id },
  //   {
  //     firstName: user.first_name,
  //     lastName: user.last_name,
  //     profileImage: user.image_url,
  //   }
  // );
}

/**
 * Handle user deletion event
 * Triggered when user is deleted from Clerk
 */
async function handleUserDeleted(user: any) {
  console.log(`✓ User deleted: ${user.id}`);

  // TODO: Delete or anonymize user data
  // Example:
  // await db.users.delete({ clerkId: user.id });
}

/**
 * Handle session creation event
 * Triggered on successful sign-in
 */
async function handleSessionCreated(session: any) {
  console.log(`✓ Session created for user: ${session.user_id}`);

  // TODO: Log session analytics if needed
}

/**
 * Handle session end event
 * Triggered on sign-out
 */
async function handleSessionEnded(session: any) {
  console.log(`✓ Session ended for user: ${session.user_id}`);

  // TODO: Clean up session-specific data if needed
}

/**
 * Handle email address creation
 */
async function handleEmailCreated(emailAddress: any) {
  console.log(
    `✓ Email created for user: ${emailAddress.user_id} (${emailAddress.email_address})`
  );
}

/**
 * Handle email verification
 */
async function handleEmailVerified(emailAddress: any) {
  console.log(
    `✓ Email verified for user: ${emailAddress.user_id} (${emailAddress.email_address})`
  );

  // TODO: Update email verification status in database
}
