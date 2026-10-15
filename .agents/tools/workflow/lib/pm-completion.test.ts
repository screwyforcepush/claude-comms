import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decidePmCompletion } from './pm-completion.js';
import { type ChainGroup } from './guardian-checkpoint.js';

const letters: Record<string, string> = {
  P: 'plan', M: 'pm', I: 'implement', R: 'review', D: 'document',
};

function chain(shape: string): ChainGroup[] {
  return shape.split(' ').map((types, index) => ({
    _id: `g${index}`,
    jobTypes: types.split('+').map(type => letters[type]),
  }));
}

const checkpointShape = 'P M I M R+R+R+D M I M R+R+R+D M I M R+R+R+D M';
const blocked = { status: 'blocked', blockedReason: '  Which scope should ship?\nUser decision required.  ' };

describe('PM completion dispatch', () => {
  it('hands a blocked final PM to the Steward with the recorded reason verbatim', () => {
    const groups = chain('P M');
    assert.deepEqual(decidePmCompletion(blocked, groups, 'g1'), {
      kind: 'blocked', blockedReason: blocked.blockedReason,
    });
    assert.equal(blocked.status, 'blocked');
  });

  it('hands a blocked PM to the Steward even when a successor is queued', () => {
    assert.deepEqual(decidePmCompletion(blocked, chain('P M I'), 'g1'), {
      kind: 'blocked', blockedReason: blocked.blockedReason,
    });
  });

  it('block assessment replaces a convergence checkpoint with a queued successor', () => {
    const groups = chain(`${checkpointShape} I`);
    assert.deepEqual(decidePmCompletion(blocked, groups, groups.at(-2)!._id), {
      kind: 'blocked', blockedReason: blocked.blockedReason,
    });
  });

  it('does not inspect the chain before dispatching a block', () => {
    const unavailableChain = new Proxy([] as ChainGroup[], {
      get() { throw new Error('Blocked dispatch must not inspect the chain'); },
    });
    assert.deepEqual(decidePmCompletion(blocked, unavailableChain, 'missing'), {
      kind: 'blocked', blockedReason: blocked.blockedReason,
    });
  });

  it('passes an absent recorded reason as empty without inventing an explanation', () => {
    assert.deepEqual(decidePmCompletion({ status: 'blocked' }, [], 'g1'), {
      kind: 'blocked', blockedReason: '',
    });
  });

  it('keeps active final behavior, including finality at a checkpoint boundary', () => {
    for (const shape of ['P M', checkpointShape]) {
      const groups = chain(shape);
      assert.deepEqual(decidePmCompletion({ status: 'active' }, groups, groups.at(-1)!._id), {
        kind: 'final',
      });
    }
  });

  it('keeps the active convergence checkpoint and its metadata', () => {
    const groups = chain(`${checkpointShape} I`);
    assert.deepEqual(decidePmCompletion({ status: 'active' }, groups, groups.at(-2)!._id), {
      kind: 'checkpoint',
      checkpoint: { round: 1, completionReviews: 3, chainShape: checkpointShape },
    });
  });

  it('keeps active none behavior for ordinary PMs and missing chain groups', () => {
    for (const id of ['g1', 'missing']) {
      assert.deepEqual(decidePmCompletion({ status: 'active' }, chain('P M I'), id), { kind: 'none' });
    }
  });

  it('does not treat a stale reason on an unblocked assignment as a current block', () => {
    assert.deepEqual(decidePmCompletion({ ...blocked, status: 'active' }, chain('P M'), 'g1'), {
      kind: 'final',
    });
  });

  it('preserves final summaries when the PM already marked the assignment complete', () => {
    assert.deepEqual(decidePmCompletion({ status: 'complete' }, chain('P M'), 'g1'), {
      kind: 'final',
    });
  });
});
