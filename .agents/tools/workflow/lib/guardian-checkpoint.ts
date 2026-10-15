/** Convergence checkpoints keep the Guardian focused on patterns across PM cycles.
 * @see docs/project/spec/mental-model.md § The Machine — Roles and What Each Layer Deliberately Lacks
 */
export const CHECKPOINT_INTERVAL = 3;

/** One group in chain order (headGroupId → nextGroupId), with stored job order. */
export interface ChainGroup {
  _id: string;
  jobTypes: string[];
}

export interface GuardianCheckpoint {
  round: number;
  completionReviews: number;
  chainShape: string;
}

export type GuardianWake =
  | { kind: "final" }
  | { kind: "checkpoint"; checkpoint: GuardianCheckpoint }
  | { kind: "none" };

export function isCompletionReviewGroup(group: ChainGroup): boolean {
  return group.jobTypes.includes("review") && group.jobTypes.includes("document");
}

const JOB_LETTERS = new Map([
  ["plan", "P"], ["pm", "M"], ["implement", "I"],
  ["review", "R"], ["uat", "U"], ["document", "D"],
]);

export function formatChainShape(groups: readonly ChainGroup[]): string {
  return groups.map(group => group.jobTypes
    .map(type => JOB_LETTERS.get(type) ?? type.charAt(0).toUpperCase())
    .join("+")).join(" ");
}

export function decideGuardianWake(
  chain: readonly ChainGroup[],
  completedPmGroupId: string
): GuardianWake {
  const index = chain.findIndex(group => group._id === completedPmGroupId);
  if (index === -1 || !chain[index].jobTypes.includes("pm")) return { kind: "none" };

  // Final assessment replaces the checkpoint even at an interval boundary.
  if (index === chain.length - 1) return { kind: "final" };
  if (index === 0 || !isCompletionReviewGroup(chain[index - 1])) return { kind: "none" };

  let completionReviews = 0;
  for (let i = 0; i < index; i++) {
    if (isCompletionReviewGroup(chain[i])) completionReviews++;
  }
  if (completionReviews === 0 || completionReviews % CHECKPOINT_INTERVAL !== 0) return { kind: "none" };

  return {
    kind: "checkpoint",
    checkpoint: {
      round: completionReviews / CHECKPOINT_INTERVAL,
      completionReviews,
      chainShape: formatChainShape(chain.slice(0, index + 1)),
    },
  };
}
