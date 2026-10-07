'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path');
const { Arch } = require('builder-util');
const { verifyMacPackage, requiredArchitectures } = require('../scripts/verify-package-architecture.cjs');
test('matching thin and universal package entry points pass architecture verification', () => {
  for (const arch of [Arch.arm64, Arch.x64, Arch.universal]) {
    const expected = requiredArchitectures(arch), files = [];
    const result = verifyMacPackage('/nonexistent/Scribble.app', arch, file => { files.push(file); return expected; });
    assert.equal(result.checkedExecutables, 6);
    assert.equal(files.length, 6);
    assert.ok(files.some(file => file.endsWith('ScribbleShare')));
    assert.deepEqual(result.architectures, expected);
  }
});
test('Intel Electron with an ARM speech runtime fails before claiming a usable package', () => {
  assert.throws(() => verifyMacPackage('/nonexistent/Scribble.app', Arch.x64, file => path.basename(file) === 'whisper-cli' ? ['arm64'] : ['x86_64']), /native\/speech\/whisper-cli.*needs x86_64, contains arm64/);
  assert.throws(() => verifyMacPackage('/nonexistent/Scribble.app', Arch.universal, file => path.basename(file) === 'ffmpeg' ? ['arm64'] : ['arm64', 'x86_64']), /native\/ffmpeg.*needs arm64\+x86_64, contains arm64/);
});
test('unsupported architectures and unreadable required executables fail closed', () => {
  assert.throws(() => requiredArchitectures(Arch.ia32), /Unsupported/);
  assert.throws(() => verifyMacPackage('/nonexistent/Scribble.app', Arch.arm64, () => { throw Error('Cannot inspect packaged executable'); }), /Cannot inspect/);
});
