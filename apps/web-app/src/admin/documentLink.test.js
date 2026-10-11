import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LINK_LENGTH, linkHost, parseDocumentLink } from './documentLink.js';

test('a blank link is valid and means pending', () => {
  assert.deepEqual(parseDocumentLink(''), { value: null, error: null });
  assert.deepEqual(parseDocumentLink('   '), { value: null, error: null });
  assert.deepEqual(parseDocumentLink(null), { value: null, error: null });
  assert.deepEqual(parseDocumentLink(undefined), { value: null, error: null });
});

test('an https link is accepted and trimmed', () => {
  assert.deepEqual(
    parseDocumentLink('  https://drive.google.com/file/d/abc/view  '),
    { value: 'https://drive.google.com/file/d/abc/view', error: null },
  );
});

test('anything that is not a full https address is rejected', () => {
  for (const bad of [
    'http://example.com/a.pdf',
    'javascript:alert(1)',
    'data:text/html;base64,AAAA',
    '/documents/a.pdf',
    'ftp://example.com/a.pdf',
    'https://',
    'https:example.com',
    'drive.google.com/file/d/abc',
  ]) {
    const result = parseDocumentLink(bad);
    assert.equal(result.value, null, bad);
    assert.ok(result.error, bad);
  }
});

test('spaces and over-long links are rejected', () => {
  assert.ok(parseDocumentLink('https://exa mple.com/a.pdf').error);
  assert.ok(parseDocumentLink(`https://example.com/${'a'.repeat(MAX_LINK_LENGTH)}`).error);
});

test('linkHost shows the host without www, or null with no valid link', () => {
  assert.equal(linkHost('https://www.example.com/a.pdf'), 'example.com');
  assert.equal(linkHost('https://drive.google.com/file/d/abc/view'), 'drive.google.com');
  assert.equal(linkHost(''), null);
  assert.equal(linkHost(null), null);
  assert.equal(linkHost('javascript:alert(1)'), null);
});
