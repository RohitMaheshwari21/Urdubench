import { cookies } from "next/headers";
import { forbidden, notConfigured, respond, sameOrigin } from "@/lib/request";
import { getServices } from "@/lib/services";
import { withLog } from "@/lib/log";

/** Deletes the anonymous user behind this browser's cookie, with all its votes and quiz answers. */
export const DELETE = withLog("me", async () => {
  if (!(await sameOrigin())) return forbidden();
  const jar = await cookies();
  const uid = jar.get("ub_uid")?.value;
  if (!uid) return respond({ status: 200, body: { deleted: false, message: "Nothing stored for this browser." } });
  const { store } = getServices();
  if (!store) return notConfigured();
  await store.deleteUser(uid);
  jar.delete("ub_uid");
  return respond({ status: 200, body: { deleted: true, message: "Your votes and quiz answers were deleted." } });
});
