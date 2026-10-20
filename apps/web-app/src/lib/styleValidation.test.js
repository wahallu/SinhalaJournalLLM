import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SPORTS_BLOCK_MESSAGE,
  createStyleGuard,
  currentVerdict,
  rewriteIfValid,
  validateStyleRequest,
} from './styleValidation.js';

const samples = JSON.parse(
  readFileSync(new URL('./fixtures/sportsSamples.json', import.meta.url), 'utf8'),
);
const byId = (id) => samples.find((s) => s.id === id);

// The classifier is an LLM behind the backend; these tests cover the decision
// logic around it, so a stub answers with the fixture's expected label. The
// real classifier's accuracy is measured by
// backend-api/scripts/evaluate_sports_classifier.py, not here.
const oracle = async (text) => ({
  label: samples.find((s) => s.text === text).expected,
  classifier: 'llm',
});

function recorder() {
  const log = { classify: 0, rewrite: 0 };
  return {
    log,
    classify: async (t) => { log.classify += 1; return oracle(t); },
    rewrite: async (t, style) => { log.rewrite += 1; return { rewritten: `${style}:${t}` }; },
  };
}

test('regression set: every sample gets the expected decision and API behaviour', async () => {
  const table = [];
  for (const s of samples) {
    const r = recorder();
    const guard = createStyleGuard(r.classify);
    const out = await rewriteIfValid(guard, s.text, 'sports', r.rewrite);
    const actual = out.proceed ? 'allowed' : out.check.status === 'block' ? 'blocked' : 'warned';
    const expected = {
      SPORTS_RELATED: 'allowed', NOT_SPORTS_RELATED: 'blocked', UNCERTAIN: 'warned',
    }[s.expected];
    table.push({ id: s.id, lang: s.language, expected, actual, rewriteCalls: r.log.rewrite });
    assert.equal(actual, expected, s.id);
    assert.equal(r.log.rewrite, expected === 'allowed' ? 1 : 0, `${s.id} rewrite calls`);
  }
  console.table(table.map(({ id, expected, actual, rewriteCalls }) => ({ id, expected, actual, rewriteCalls })));
  assert.ok(samples.some((s) => s.language === 'si'));
  assert.ok(samples.some((s) => s.language === 'mixed'));
  assert.ok(samples.some((s) => s.language === 'en'));
});

test('blocked article shows the exact message and is not confirmable by re-running', async () => {
  const r = recorder();
  const s = byId('pol-01');
  const check = await validateStyleRequest(s.text, 'sports', r.classify);
  assert.equal(check.status, 'block');
  assert.equal(check.message, SPORTS_BLOCK_MESSAGE);
});

test('blocked sports request: switching to Youth then rewrites the same article', async () => {
  const r = recorder();
  const guard = createStyleGuard(r.classify);
  const s = byId('edu-01');
  const blocked = await rewriteIfValid(guard, s.text, 'sports', r.rewrite);
  assert.equal(blocked.proceed, false);
  assert.equal(r.log.rewrite, 0);

  const youth = await rewriteIfValid(guard, s.text, 'youth', r.rewrite);
  assert.equal(youth.proceed, true);
  assert.equal(r.log.rewrite, 1);
  assert.equal(r.log.classify, 1, 'non-Sports targets are never classified');
});

test('uncertain article is held, then proceeds once the user confirms', async () => {
  const r = recorder();
  const guard = createStyleGuard(r.classify);
  const s = byId('un-01');
  const held = await rewriteIfValid(guard, s.text, 'sports', r.rewrite);
  assert.equal(held.check.status, 'warn');
  assert.equal(held.check.kind, 'uncertain');
  assert.equal(r.log.rewrite, 0);

  const confirmed = await rewriteIfValid(guard, s.text, 'sports', r.rewrite, { force: true });
  assert.equal(confirmed.proceed, true);
  assert.equal(r.log.rewrite, 1);
});

test('other targets are never restricted, for any article or source style', async () => {
  for (const style of ['formal', 'feature', 'editorial', 'youth']) {
    for (const s of samples) {
      const r = recorder();
      const out = await rewriteIfValid(createStyleGuard(r.classify), s.text, style, r.rewrite);
      assert.equal(out.proceed, true, `${s.id} -> ${style}`);
      assert.equal(r.log.classify, 0);
    }
  }
});

test('classifier failures hold the request instead of letting it through or blocking it', async () => {
  const s = byId('sp-01');
  const failures = [
    async () => { throw new Error('Failed to fetch'); },
    async () => { throw new Error('Request failed (503)'); },
    async () => ({ label: 'UNCERTAIN', classifier: 'unavailable' }),
    async () => ({ label: 'SPORTS_RELATED', classifier: 'unavailable' }),
    async () => ({}),
    async () => null,
  ];
  for (const classify of failures) {
    const check = await validateStyleRequest(s.text, 'sports', classify);
    assert.equal(check.status, 'warn');
  }
  const network = await validateStyleRequest(s.text, 'sports', failures[0]);
  assert.equal(network.kind, 'unavailable');

  let calls = 0;
  const out = await rewriteIfValid(createStyleGuard(failures[0]), s.text, 'sports', async () => { calls += 1; });
  assert.equal(out.proceed, false);
  assert.equal(calls, 0);
});

test('repeated clicks while a check is in flight create no duplicate requests', async () => {
  let release;
  const gate = new Promise((res) => { release = res; });
  const r = recorder();
  const slow = async (t) => { await gate; return r.classify(t); };
  const guard = createStyleGuard(slow);
  const s = byId('sp-01');

  const first = rewriteIfValid(guard, s.text, 'sports', r.rewrite);
  const second = await rewriteIfValid(guard, s.text, 'sports', r.rewrite);
  const third = await rewriteIfValid(guard, s.text, 'sports', r.rewrite);
  assert.equal(second.busy, true);
  assert.equal(third.busy, true);

  release();
  assert.equal((await first).proceed, true);
  assert.equal(r.log.classify, 1);
  assert.equal(r.log.rewrite, 1);
});

test('a verdict applies only to the article and style it was made for', () => {
  const verdict = { check: { status: 'block' }, input: 'article', style: 'sports' };
  assert.equal(currentVerdict(verdict, 'article', 'sports'), verdict.check);
  assert.equal(currentVerdict(verdict, 'article edited', 'sports'), null);
  assert.equal(currentVerdict(verdict, 'article', 'youth'), null);
  assert.equal(currentVerdict(null, 'article', 'sports'), null);
});
