# CLERK AUTHENTICATION - QUICK IMPLEMENTATION GUIDE

**Status**: Ready to Implement  
**Time Estimate**: 45-60 minutes  
**Difficulty**: ⭐⭐ (Medium)

---

## Prerequisites

✅ Clerk API keys already in `docker-compose.yml`:
```yaml
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
CLERK_SECRET_KEY: ${CLERK_SECRET_KEY}
```

---

## STEP 1: Update Frontend Layout (5 min)

**File**: `apps/web/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Clisonix - AI Industrial Platform",
  description: "Professional AI services for enterprises",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

---

## STEP 2: Create Auth Routes (10 min)

**Create directory**: `apps/web/app/(auth)/sign-in/`

**File**: `apps/web/app/(auth)/sign-in/page.tsx`

```typescript
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md">
        <SignIn
          appearance={{
            baseTheme: "dark",
            elements: {
              rootBox: "mx-auto",
              card: "bg-gray-800 border border-gray-700",
            },
          }}
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**File**: `apps/web/app/(auth)/sign-up/page.tsx`

```typescript
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md">
        <SignUp
          appearance={{
            baseTheme: "dark",
            elements: {
              rootBox: "mx-auto",
              card: "bg-gray-800 border border-gray-700",
            },
          }}
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

---

## STEP 3: Add Authentication Middleware (10 min)

**File**: `apps/web/middleware.ts` (CREATE IF DOESN'T EXIST)

```typescript
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Routes that don't require authentication
  publicRoutes: [
    "/",
    "/pricing",
    "/docs",
    "/api/webhooks/clerk",
    "/api/health",
  ],
  
  // Routes that require authentication
  ignoredRoutes: ["/health", "/status"],
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/webhooks (webhook routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/webhooks|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

---

## STEP 4: Create Dashboard Layout with User Button (8 min)

**File**: `apps/web/app/(dashboard)/layout.tsx`

```typescript
import { UserButton, currentUser } from "@clerk/nextjs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-white">Clisonix Dashboard</h1>
          
          <div className="flex items-center gap-4">
            <span className="text-gray-300">
              Welcome, {user?.firstName || user?.emailAddresses[0].emailAddress}
            </span>
            <UserButton
              appearance={{
                baseTheme: "dark",
                elements: {
                  avatarBox: "w-10 h-10",
                },
              }}
              afterSignOutUrl="/"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">{children}</main>
    </div>
  );
}
```

---

## STEP 5: Create Protected Dashboard Page (5 min)

**File**: `apps/web/app/(dashboard)/dashboard/page.tsx`

```typescript
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Profile</h2>
        <dl className="space-y-2 text-gray-300">
          <div>
            <dt className="font-semibold">Email:</dt>
            <dd>{user.emailAddresses[0].emailAddress}</dd>
          </div>
          <div>
            <dt className="font-semibold">Name:</dt>
            <dd>{user.firstName} {user.lastName}</dd>
          </div>
          <div>
            <dt className="font-semibold">User ID:</dt>
            <dd className="text-xs font-mono">{user.id}</dd>
          </div>
          <div>
            <dt className="font-semibold">Joined:</dt>
            <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      {/* Placeholder for services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ServiceCard
          title="Ocean Core"
          description="Knowledge orchestration engine"
          icon="🌊"
          status="online"
        />
        <ServiceCard
          title="Curiosity Ocean"
          description="Hybrid AI assistant"
          icon="🧠"
          status="online"
        />
      </div>
    </div>
  );
}

function ServiceCard({
  title,
  description,
  icon,
  status,
}: {
  title: string;
  description: string;
  icon: string;
  status: "online" | "offline";
}) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-white">
          {icon} {title}
        </h3>
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            status === "online"
              ? "bg-green-900 text-green-200"
              : "bg-red-900 text-red-200"
          }`}
        >
          {status}
        </span>
      </div>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
```

---

## STEP 6: Create User Sync API (10 min)

**File**: `apps/web/app/api/auth/sync-user/route.ts`

```typescript
import { currentUser } from "@clerk/nextjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Sync with User Management service
    const response = await fetch(
      "http://localhost:8070/api/users/sync-from-clerk",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
        body: JSON.stringify({
          clerk_id: user.id,
          email: user.emailAddresses[0].emailAddress,
          first_name: user.firstName,
          last_name: user.lastName,
          username: user.emailAddresses[0].emailAddress.split("@")[0],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`User Management service error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      user_id: data.user_id,
      message: "User synced successfully",
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync user" },
      { status: 500 }
    );
  }
}
```

---

## STEP 7: Update User Management Service (10 min)

**File**: `services/user-management/main.py` (ADD ENDPOINT)

```python
from fastapi import HTTPException, Depends
from clerk_webhook import router as clerk_router

# Add this endpoint to sync users from Clerk
@app.post("/api/users/sync-from-clerk")
async def sync_from_clerk(data: dict):
    """
    Sync user from Clerk to our database
    Called after Clerk authentication
    """
    try:
        user_registry = get_user_registry()
        
        # Check if user already exists
        user = user_registry.get_user_by_email(data["email"])
        
        if not user:
            # Create new user
            user = user_registry.create_user(
                email=data["email"],
                username=data["username"],
                first_name=data.get("first_name"),
                last_name=data.get("last_name"),
                external_id=data["clerk_id"]  # Store Clerk ID
            )
            logger.info(f"✅ Created new user from Clerk: {data['email']}")
        else:
            # Update existing user
            user_registry.update_user(
                user_id=user["id"],
                external_id=data["clerk_id"],
                first_name=data.get("first_name"),
                last_name=data.get("last_name")
            )
            logger.info(f"✅ Updated existing user from Clerk: {data['email']}")
        
        return {
            "success": True,
            "user_id": user["id"],
            "email": user["email"]
        }
    
    except Exception as e:
        logger.error(f"❌ Sync error: {e}")
        raise HTTPException(status_code=500, detail="User sync failed")
```

---

## STEP 8: Add Clerk Webhook Integration (8 min)

**File**: `services/user-management/clerk_webhook.py` (UPDATE)

```python
"""
CLERK WEBHOOK HANDLER
Handles Clerk events: user.created, user.updated, user.deleted
"""

import os
import logging
from fastapi import APIRouter, Request, HTTPException
from svix.webhooks import Webhook

logger = logging.getLogger("clerk_webhook")
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Clerk webhook secret from environment
CLERK_WEBHOOK_SECRET = os.getenv("CLERK_WEBHOOK_SECRET")

@router.post("/clerk")
async def handle_clerk_webhook(request: Request):
    """
    Process Clerk webhooks
    Events: user.created, user.updated, user.deleted
    """
    try:
        # Verify webhook signature
        payload = await request.body()
        headers = dict(request.headers)
        
        wh = Webhook(CLERK_WEBHOOK_SECRET)
        msg = wh.verify(payload, headers)
        
        event_data = msg["data"]
        event_type = msg["type"]
        
        logger.info(f"📬 Received Clerk webhook: {event_type}")
        
        if event_type == "user.created":
            # New user from Clerk
            logger.info(f"✨ New user from Clerk: {event_data['email_addresses'][0]['email_address']}")
            # Handled by sync-from-clerk endpoint
            
        elif event_type == "user.updated":
            # User profile updated
            logger.info(f"🔄 User updated: {event_data['id']}")
            # Sync profile updates
            
        elif event_type == "user.deleted":
            # User deleted from Clerk
            logger.info(f"🗑️ User deleted: {event_data['id']}")
            # Optional: soft-delete in our system
        
        return {"status": "received"}
    
    except Exception as e:
        logger.error(f"❌ Webhook error: {e}")
        raise HTTPException(status_code=400, detail="Webhook verification failed")
```

---

## STEP 9: Update Environment Variables

**File**: `.env.local` (Create in repo root)

```bash
# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# User Management Service
USER_MANAGEMENT_URL=http://localhost:8070
USER_MANAGEMENT_API_KEY=your_api_key_here
```

---

## STEP 10: Add NPM Dependencies

**Command**:
```bash
cd apps/web
npm install @clerk/nextjs
npm install --save-dev @clerk/types
```

---

## TESTING CHECKLIST

- [ ] Start dev server: `npm run dev` (port 3000)
- [ ] Navigate to `http://localhost:3000`
- [ ] Click "Sign Up" → redirects to `/sign-up` (Clerk component shows)
- [ ] Enter email + password → submit
- [ ] Verify webhook fires in Clerk dashboard
- [ ] Check User Management service logs: "✅ Created new user from Clerk"
- [ ] After signup, redirects to `/dashboard`
- [ ] Dashboard shows user profile
- [ ] Click user avatar → "Sign out" works
- [ ] After logout, redirects to homepage
- [ ] Try accessing `/dashboard` without auth → redirects to `/sign-in`

---

## TROUBLESHOOTING

### Issue: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set"
**Fix**: Check `.env.local` has the key AND it's prefixed with `NEXT_PUBLIC_`

### Issue: Clerk component shows blank
**Fix**: 
1. Verify keys in Clerk dashboard match `.env.local`
2. Check browser console for CORS errors
3. Try clearing cache: `npm run build && npm run start`

### Issue: Webhook not firing
**Fix**:
1. Check `CLERK_WEBHOOK_SECRET` is correct
2. Verify webhook URL in Clerk dashboard: `http://localhost:8070/webhooks/clerk`
3. Check User Management service logs for errors

### Issue: User sync fails (500 error)
**Fix**:
1. Verify User Management service is running: `curl http://localhost:8070/health`
2. Check `services/user-management/main.py` has the sync endpoint
3. Check database connection in UserRegistry

---

## NEXT STEPS

After Clerk auth works:
1. Proceed to **GAP 2: Paywall** integration
2. Then **GAP 3: User Memory** (IndexedDB storage)
3. Then **GAP 4: i18n** (multi-language support)

---

*Time to implement: ~45-60 minutes*  
*Difficulty: Medium (⭐⭐)*  
*Blocking other features: YES - Auth is foundation*

**Ready to start? Execute STEP 1-10 in order.**
