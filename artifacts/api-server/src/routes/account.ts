import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, projectsTable } from "@workspace/db";
import { ClaimGuestLibraryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/account/claim-guest", async (req, res): Promise<void> => {
  const userId = res.locals.clerkUserId;
  const guestOwnerId = res.locals.guestOwnerId;

  if (typeof userId !== "string" || !userId) {
    res.status(401).json({ error: "Sign in to save projects to your account." });
    return;
  }
  if (typeof guestOwnerId !== "string" || !guestOwnerId) {
    res.status(500).json({ error: "This browser's guest workspace is unavailable." });
    return;
  }

  const ownerId = `clerk:${userId}`;
  if (guestOwnerId === ownerId) {
    res.json(ClaimGuestLibraryResponse.parse({ transferredCount: 0 }));
    return;
  }

  const transferred = await db
    .update(projectsTable)
    .set({ ownerId })
    .where(eq(projectsTable.ownerId, guestOwnerId))
    .returning({ id: projectsTable.id });

  res.json(
    ClaimGuestLibraryResponse.parse({ transferredCount: transferred.length }),
  );
});

export default router;
