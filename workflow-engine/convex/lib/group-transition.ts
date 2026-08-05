// Pure decision logic for finalizing a job group.
//
// Exactly-once guarantee: complete/fail mutations run as serializable Convex
// transactions, so at most one transaction per group lifecycle can observe
// groupStatus non-terminal while all member jobs are terminal. That caller
// receives shouldFlip=true — the token authorizing group-completion side
// effects (PM trigger, guardian eval, assignment completion). Retry paths
// (executeRetry, retryGroup) reset the group to "pending", which re-arms the
// token for the retry's own completion.

export type GroupStatus = "pending" | "running" | "complete" | "failed";
export type JobStatus = "pending" | "running" | "complete" | "failed" | "awaiting_retry";

export interface GroupTransition {
  shouldFlip: boolean;
  newStatus?: "complete" | "failed";
}

export function resolveGroupTransition(
  groupStatus: GroupStatus,
  jobStatuses: JobStatus[]
): GroupTransition {
  // Already finalized — the flip token was minted in an earlier transaction
  if (groupStatus === "complete" || groupStatus === "failed") {
    return { shouldFlip: false };
  }

  const allTerminal = jobStatuses.every(
    (s) => s === "complete" || s === "failed"
  );
  if (!allTerminal) {
    return { shouldFlip: false };
  }

  const anySucceeded = jobStatuses.some((s) => s === "complete");
  return { shouldFlip: true, newStatus: anySucceeded ? "complete" : "failed" };
}
