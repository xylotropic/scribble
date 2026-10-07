"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { formatGrounded } = require("../src/main/summary");
test("Summary discards invented ownership and events while retaining exact evidence", () => {
  const transcript =
    "Ana: We agreed to launch on October 14. Priya: I will run the billing test on October 10. Sam: No owner has been assigned to the pricing decision.";
  const output = formatGrounded(
    transcript,
    'Ana will fix pricing. "We agreed to launch on October 14." Priya: "I will run the billing test on October 10." Ana: "No owner has been assigned to the pricing decision." "Launch was successful yesterday."',
  );
  assert.match(output, /Decisions\n- Ana: “We agreed/);
  assert.match(output, /Action items\n- Priya: “I will run/);
  assert.match(output, /Unresolved\n- Sam: “No owner/);
  assert.doesNotMatch(output, /Ana will fix|successful yesterday/);
});
test("Tentative quoted claims remain unresolved without fabricated commitment", () => {
  const output = formatGrounded(
    "Priya: The migration might be blocked by the key.",
    '"The migration might be blocked by the key."',
  );
  assert.match(output, /Action items\nNo explicit evidence/);
  assert.match(output, /Unresolved\n- Priya: “The migration might/);
});
