import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECKPOINT_INTERVAL,
  decideGuardianWake,
  formatChainShape,
  isCompletionReviewGroup,
  type ChainGroup,
  type GuardianWake,
} from './guardian-checkpoint.js';

const letters: Record<string, string> = {
  P: 'plan', M: 'pm', I: 'implement', R: 'review', U: 'uat', D: 'document',
};
const CR = 'R+R+R+D';
const NORTH_STAR_SHAPE = 'P M I M R+R+R+D M I M R+R+R+D M I M R+R+R+D M';

function chain(shape: string): ChainGroup[] {
  return shape.trim() ? shape.trim().split(/\s+/).map((group, index) => ({
    _id: `g${index}`,
    jobTypes: group.split('+').map(type => letters[type] ?? type),
  })) : [];
}

function pmAfterReview(groups: ChainGroup[], reviewNumber: number): ChainGroup {
  const review = groups.filter(isCompletionReviewGroup)[reviewNumber - 1];
  return groups[groups.indexOf(review) + 1];
}

describe('guardian convergence checkpoints', () => {
  it('row 1: seven-round thrash wakes only after CR 3 and 6, then at final', () => {
    assert.equal(CHECKPOINT_INTERVAL, 3);
    const groups = chain(`P M I M ${Array(7).fill(`${CR} M I M`).join(' ')}`);
    const checkpoints: GuardianWake[] = [];
    for (const [index, group] of groups.entries()) {
      if (!group.jobTypes.includes('pm')) continue;
      const wake = decideGuardianWake(groups, group._id);
      const count = groups.slice(0, index).filter(isCompletionReviewGroup).length;
      if (index === groups.length - 1) {
        assert.deepEqual(wake, { kind: 'final' });
      } else if (isCompletionReviewGroup(groups[index - 1]) && (count === 3 || count === 6)) {
        assert.deepEqual(wake, {
          kind: 'checkpoint',
          checkpoint: { round: count / 3, completionReviews: count, chainShape: formatChainShape(groups.slice(0, index + 1)) },
        });
        checkpoints.push(wake);
      } else {
        assert.deepEqual(wake, { kind: 'none' }, `PM at index ${index}`);
      }
    }
    assert.equal(checkpoints.length, 2);
    assert.deepEqual(checkpoints[0], {
      kind: 'checkpoint',
      checkpoint: { round: 1, completionReviews: 3, chainShape: NORTH_STAR_SHAPE },
    });
    const thirdPm = pmAfterReview(groups, 3);
    const prefix = groups.slice(0, groups.indexOf(thirdPm) + 2);
    assert.equal(prefix.at(-1)?.jobTypes[0], 'implement');
    assert.deepEqual(decideGuardianWake(prefix, thirdPm._id), decideGuardianWake(groups, thirdPm._id));
  });

  it('row 2: finality takes priority over the third completion review', () => {
    const groups = chain(`P M I M ${Array(2).fill(`${CR} M I M`).join(' ')} ${CR} M`);
    assert.deepEqual(decideGuardianWake(groups, groups.at(-1)!._id), { kind: 'final' });
  });

  it('row 3: document-only groups neither count nor qualify as the immediate predecessor', () => {
    const base = `P M I M ${Array(2).fill(`${CR} M I M`).join(' ')} ${CR}`;
    for (const tail of ['D M', 'D M I']) {
      const groups = chain(`${base} M ${tail}`);
      assert.deepEqual(decideGuardianWake(groups, pmAfterReview(groups, 3)._id), {
        kind: 'checkpoint', checkpoint: { round: 1, completionReviews: 3, chainShape: NORTH_STAR_SHAPE },
      });
      const lastPm = groups.filter(group => group.jobTypes.includes('pm')).at(-1)!;
      assert.deepEqual(decideGuardianWake(groups, lastPm._id), { kind: tail.endsWith('I') ? 'none' : 'final' });
    }
    const interveningDocument = chain(`${base} D M I`);
    assert.deepEqual(decideGuardianWake(interveningDocument, interveningDocument.at(-2)!._id), { kind: 'none' });
  });

  it('row 4: implement can lead directly into a completion review', () => {
    const groups = chain(`P M I ${CR} M I ${CR} M I ${CR} M I`);
    assert.deepEqual(decideGuardianWake(groups, groups.at(-2)!._id), {
      kind: 'checkpoint', checkpoint: {
        round: 1, completionReviews: 3, chainShape: `P M I ${CR} M I ${CR} M I ${CR} M`,
      },
    });
  });

  it('row 5: a non-PM tail permits a checkpoint but never triggers a wake itself', () => {
    const groups = chain(`${NORTH_STAR_SHAPE} I`);
    assert.deepEqual(decideGuardianWake(groups, groups.at(-2)!._id), {
      kind: 'checkpoint', checkpoint: { round: 1, completionReviews: 3, chainShape: NORTH_STAR_SHAPE },
    });
    assert.deepEqual(decideGuardianWake(groups, groups.at(-1)!._id), { kind: 'none' });
  });

  it('row 6: reviews without document do not advance or trigger checkpoints', () => {
    const reviewOnly = chain('P M I M R+R M I M R+R M I M R+R M I');
    for (const group of reviewOnly.filter(group => group.jobTypes.includes('pm'))) {
      assert.deepEqual(decideGuardianWake(reviewOnly, group._id), { kind: 'none' });
    }
    const mixed = chain(`P M I M ${Array(7).fill(`${CR} M I M R+R M I M`).join(' ')} I`);
    let count = 0;
    const checkpointCounts: number[] = [];
    for (const [index, group] of mixed.entries()) {
      if (isCompletionReviewGroup(group)) count++;
      if (!group.jobTypes.includes('pm')) continue;
      const wake = decideGuardianWake(mixed, group._id);
      if (isCompletionReviewGroup(mixed[index - 1]) && count % 3 === 0) {
        assert.equal(wake.kind, 'checkpoint');
        if (wake.kind === 'checkpoint') {
          assert.equal(wake.checkpoint.completionReviews, count);
          checkpointCounts.push(count);
        }
      } else {
        assert.deepEqual(wake, { kind: 'none' });
      }
    }
    assert.deepEqual(checkpointCounts, [3, 6]);
  });

  it('row 7: absent completed id and absent predecessor return none', () => {
    assert.deepEqual(decideGuardianWake(chain('P M'), 'missing'), { kind: 'none' });
    assert.deepEqual(decideGuardianWake([], 'missing'), { kind: 'none' });
    assert.deepEqual(decideGuardianWake(chain('M I'), 'g0'), { kind: 'none' });
  });

  it('row 8: formats stored order, known letters, unknown fallback, and empty chains', () => {
    assert.equal(formatChainShape(chain('P M I R+R+U+D research+audit')), 'P M I R+R+U+D R+A');
    assert.equal(formatChainShape(chain('D+R')), 'D+R');
    assert.equal(formatChainShape([]), '');
  });

  it('completion reviews require exact review and document types, with optional UAT', () => {
    assert.equal(isCompletionReviewGroup(chain('R+D+U')[0]), true);
    for (const shape of ['R+R', 'D', 'security-review+D', 'R+documentation']) {
      assert.equal(isCompletionReviewGroup(chain(shape)[0]), false, shape);
    }
  });
});
