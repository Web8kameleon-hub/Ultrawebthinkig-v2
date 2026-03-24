/**
 * User Profile API
 * GET /api/user/profile - Get current user profile
 * PUT /api/user/profile - Update user profile
 *
 * Production: Connect to PostgreSQL database
 * Development: Returns config-based user data
 */

import { currentUser } from "@clerk/nextjs/server";
import { apiError, apiSuccess } from "@/lib/api/response";

// User profile configuration - In production, this comes from database
// Plan is determined by Stripe subscription status (default: free)
const USER_PROFILE = {
  id: "usr_clisonix_001",
  name: process.env.USER_NAME || "Ledjan Ahmati",
  email: process.env.USER_EMAIL || "clisonix@pm.me",
  avatar: process.env.USER_AVATAR || null,
  plan: process.env.USER_PLAN || "free", // Will be overridden by Stripe subscription
  company: process.env.USER_COMPANY || "ABA GmbH",
  phone: process.env.USER_PHONE || "+49 176 XXX XXXX",
  timezone: process.env.USER_TIMEZONE || "Europe/Berlin",
  language: process.env.USER_LANGUAGE || "en",
  role: "admin",
  createdAt: "2024-01-15T10:00:00Z",
  updatedAt: new Date().toISOString(),
};

export async function GET() {
  try {
    const user = await currentUser();
    const profile = {
      ...USER_PROFILE,
      id: user?.id || USER_PROFILE.id,
      name:
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.fullName ||
        USER_PROFILE.name,
      email: user?.emailAddresses?.[0]?.emailAddress || USER_PROFILE.email,
      avatar: user?.imageUrl || USER_PROFILE.avatar,
    };

    return apiSuccess(profile, {
      meta: {
        source: user
          ? "clerk"
          : process.env.DATABASE_URL
            ? "database"
            : "config",
      },
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return apiError("PROFILE_FETCH_FAILED", "Failed to fetch profile", {
      status: 500,
      details: String(error),
    });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // TODO: In production, update database
    // const session = await getServerSession(authOptions)
    // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // const updatedUser = await prisma.user.update({
    //   where: { id: session.user.id },
    //   data: { name: body.name, company: body.company, phone: body.phone }
    // })

    // For now, just return success (data won't persist without database)
    const updatedProfile = {
      ...USER_PROFILE,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return apiSuccess(updatedProfile, {
      meta: {
        persisted: false,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return apiError("PROFILE_UPDATE_FAILED", "Failed to update profile", {
      status: 500,
      details: String(error),
    });
  }
}
