import { decideGuardianWake, type ChainGroup, type GuardianWake } from './guardian-checkpoint.js';

export interface PmCompletionAssignment {
  status: string;
  blockedReason?: string;
}

export type PmCompletion = GuardianWake | { kind: 'blocked'; blockedReason: string };

/** Blocks need the user's decision regardless of chain shape or checkpoint cadence.
 * @see docs/project/spec/mental-model.md § The Machine — Roles and What Each Layer Deliberately Lacks
 */
export function decidePmCompletion(
  assignment: PmCompletionAssignment,
  chain: readonly ChainGroup[],
  completedPmGroupId: string
): PmCompletion {
  if (assignment.status === 'blocked') {
    return { kind: 'blocked', blockedReason: assignment.blockedReason ?? '' };
  }
  return decideGuardianWake(chain, completedPmGroupId);
}
