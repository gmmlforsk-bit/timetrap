const UNGROUPED_ID = "";
function dateBucketId(updatedAt: number | null | undefined, now: number): string {
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || updatedAt <= 0) {
    return UNGROUPED_ID;
  }
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  if (updatedAt >= startOfToday.getTime()) {
    return "today";
  }
  if (updatedAt >= startOfToday.getTime() - dayMs) {
    return "yesterday";
  }
  if (updatedAt >= startOfToday.getTime() - 6 * dayMs) {
    return "week";
  }
  return "older";
}


export { dateBucketId };
