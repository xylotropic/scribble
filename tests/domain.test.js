'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const domain = require('../src/main/domain');

test('state collections and nested settings never share mutable defaults', () => {
  const first = domain.freshState(), second = domain.freshState();
  first.settings.microphonePriority.push('usb'); first.dictionary.push('test');
  assert.deepEqual(second.settings.microphonePriority, []); assert.deepEqual(second.dictionary, []);
});
test('replacement boundaries retain embedded words, match Unicode, and never expand dollar syntax', () => {
  assert.equal(domain.normalizeTranscript('design SIG sig signal', { threads: [{ trigger: 'sig', replacement: '$& signature' }] }), 'design $& signature $& signature signal');
  assert.equal(domain.replacePhrase('écal cal calé', 'cal', 'X'), 'écal X calé');
  assert.equal(domain.replacePhrase('你好世界', '你好', '您好'), '您好世界');
});
test('dictionary corrections and longest threads apply before punctuation', () => {
  const actual = domain.normalizeTranscript('um hello post gress comma my email new line done question mark', { removeFillers: true, punctuation: true, dictionary: [{ word: 'PostgreSQL', aliases: ['post gress'] }], threads: [{ trigger: 'my email', replacement: 'me@example.com' }] });
  assert.equal(actual, 'hello PostgreSQL, me@example.com\ndone?');
  assert.equal(domain.normalizeTranscript('my email and my', { threads: [{ trigger: 'my', replacement: 'our' }, { trigger: 'my email', replacement: 'address' }] }), 'address and our');
});
test('template expansion substitutes known variables without code evaluation', () => {
  assert.equal(domain.expandTemplate('{{clipboard}} {{selected_text}} {{unknown}}', { clipboard: '$&', selected_text: 'selection' }), '$& selection {{unknown}}');
});
test('voice trigger uses longest prefix and leaves unmatched dictation untouched', () => {
  const short = { trigger: 'open', enabled: true }, long = { trigger: 'open project' };
  assert.equal(domain.matchShortcut('please open project Scribble', [short, long]).shortcut, long);
  assert.equal(domain.matchShortcut('opener', [short]), null);
});
test('command classification never executes and preserves application/query data', () => {
  assert.deepEqual(domain.parseCommand('set a timer for 1.5 minutes'), { type: 'timer', seconds: 90 });
  assert.deepEqual(domain.parseCommand('remind me to stretch in 2 hours'), { type: 'reminder', message: 'stretch', seconds: 7200 });
  assert.equal(domain.parseCommand('navigate to example dot com').url, 'https://example.com');
  assert.equal(domain.parseCommand('navigate to this nonsense').type, 'unknown');
  assert.deepEqual(domain.parseCommand('open Downloads folder'), { type: 'folder', folder: 'downloads' });
  assert.equal(domain.parseCommand('google a & b').url, 'https://www.google.com/search?q=a%20%26%20b');
  assert.deepEqual(domain.parseCommand('replace old with new'), { type: 'transform', action: 'replace', find: 'old', replacement: 'new' });
  assert.deepEqual(domain.parseCommand('undo that'), { type: 'edit', action: 'undo' });
});
test('stats count duplicate dates once in streak, but preserve every word', () => {
  const now = new Date(2026, 9, 7, 12);
  const history = [{ createdAt: new Date(2026, 9, 7, 10), text: 'one two', duration: 1 }, { createdAt: new Date(2026, 9, 7, 11), text: 'three' }, { createdAt: new Date(2026, 9, 6, 10), text: 'four five' }, { createdAt: 'invalid', text: 'ignored' }];
  const stats = domain.computeStats(history, now);
  assert.equal(stats.words, 5); assert.equal(stats.today, 3); assert.equal(stats.week, 5); assert.equal(stats.streak, 2); assert.equal(stats.daily.length, 7);
  assert.equal(domain.computeStats(history, new Date(2026, 9, 8, 12)).streak, 2);
  assert.equal(domain.computeStats(history, new Date(2026, 9, 9, 12)).streak, 0);
});
test('subtitle exports use milliseconds, separators and speaker labels', () => {
  const entry = { title: 'Example', text: 'Hello', segments: [{ start: 61.125, end: 62.5, text: 'Hello', speaker: 'Alice' }] };
  assert.equal(domain.exportTranscript(entry, 'srt'), '1\n00:01:01,125 --> 00:01:02,500\nAlice: Hello\n');
  assert.equal(domain.exportTranscript(entry, 'vtt'), 'WEBVTT\n\n00:01:01.125 --> 00:01:02.500\nAlice: Hello\n');
  assert.throws(() => domain.exportTranscript({ text: 'No timings' }, 'srt'), /timestamped/);
  assert.throws(() => domain.exportTranscript({ segments: [{ start: 2, end: 1, text: 'bad' }] }, 'vtt'), /timing/);
  assert.equal(JSON.parse(domain.exportTranscript(entry, 'json')).title, 'Example');
});
test('CSV handles quoted commas/newlines/escaped quotes/CRLF and rejects broken quotes', () => {
  assert.deepEqual(domain.parseCSV('trigger,replacement\r\nhello,"a,b\n""quoted"""\r\n'), [['trigger', 'replacement'], ['hello', 'a,b\n"quoted"']]);
  assert.throws(() => domain.parseCSV('"unfinished'), /Unclosed/);
});
test('imports validate identity and reject duplicates independent of capitalization', () => {
  assert.deepEqual(domain.parseImport('word,aliases\nPostgreSQL,post gress|postgres', 'dictionary')[0].aliases, ['post gress', 'postgres']);
  assert.equal(domain.parseImport('{"threads":[{"trigger":"sig","expansion":"Sam"}]}', 'threads')[0].replacement, 'Sam');
  assert.throws(() => domain.parseImport('[{"word":"Hello"},{"word":"hello"}]'), /Duplicate/);
  assert.throws(() => domain.parseImport('trigger,replacement\nsig,', 'threads'), /Replacement/);
});
