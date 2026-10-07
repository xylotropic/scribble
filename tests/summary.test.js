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
const { prompt } = require("../src/main/summary");
const structured = (text, quote, extra = {}, heading = "Resumen") =>
  JSON.stringify({
    title: "Reunión de producto",
    sections: [
      {
        kind: "overview",
        heading,
        items: [{ text, evidence: [{ quote }], ...extra }],
      },
    ],
  });
test("localized prose and headings survive with verbatim uncertainty evidence", () => {
  const source = "Ana: We might launch tomorrow, but no date is agreed.";
  const output = formatGrounded(
    source,
    structured(
      "El lanzamiento sigue siendo incierto.",
      "We might launch tomorrow, but no date is agreed.",
    ),
    "Meeting",
    "es",
  );
  assert.match(output, /Resumen\n- El lanzamiento sigue siendo incierto/);
  assert.match(output, /might launch tomorrow, but no date is agreed/);
  assert.match(output, /Decisiones/);
  assert.doesNotMatch(output, /## Decisions/);
});
test("invented ownership, unsupported deadlines and unrelated quote ownership are discarded", () => {
  const source =
    "Ana: We might launch tomorrow. Priya: I will test billing on October 10.";
  for (const extra of [
    { owner: "Ana", ownerQuote: "We might launch tomorrow." },
    { owner: "Sam", ownerQuote: "I will test billing on October 10." },
    {
      deadline: "October 14",
      deadlineQuote: "I will test billing on October 10.",
    },
  ]) {
    const output = formatGrounded(
      source,
      structured("FABRICATED", "I will test billing on October 10.", extra),
    );
    assert.doesNotMatch(output, /FABRICATED/);
  }
  const valid = formatGrounded(
    source,
    structured(
      "Priya comprobará la facturación.",
      "I will test billing on October 10.",
      {
        owner: "Priya",
        ownerQuote: "I will test billing on October 10.",
        deadline: "October 10",
        deadlineQuote: "I will test billing on October 10.",
      },
    ),
    "Meeting",
    "es",
  );
  assert.match(valid, /comprobará/);
});
test("repeated excerpts require an occurrence and attribute to the correct source speaker", () => {
  const source = "Ana: I will test billing. Priya: I will test billing.";
  const ambiguous = formatGrounded(
    source,
    structured("AMBIGUOUS", "I will test billing."),
  );
  assert.doesNotMatch(ambiguous, /AMBIGUOUS/);
  const json = JSON.parse(
    structured("SECOND", "I will test billing.", {
      owner: "Priya",
      ownerQuote: "I will test billing.",
    }),
  );
  json.sections[0].items[0].evidence[0].occurrence = 1;
  const output = formatGrounded(source, JSON.stringify(json));
  assert.match(output, /SECOND — Priya:/);
  assert.doesNotMatch(output, /SECOND — Ana:/);
});
test("malformed, oversized or unmatched responses fall back conservatively without assigning suggestions", () => {
  const source =
    "Ana: We should consider a launch. Priya: No decision was agreed.";
  for (const response of [
    "{bad",
    "x".repeat(256001),
    structured("INVENTED", "Launch succeeded yesterday."),
  ]) {
    const output = formatGrounded(source, response);
    assert.doesNotMatch(output, /INVENTED/);
    assert.match(output, /Action items\nNo explicit evidence/);
    assert.match(output, /should consider/);
  }
  const invalid = JSON.stringify({
    title: "x",
    sections: new Array(13).fill({}),
  });
  assert.doesNotMatch(formatGrounded(source, invalid), /# x/);
});
test("presets alter structure and prompts demand exact JSON evidence rather than English prose headings", () => {
  assert.match(
    prompt("Lecture", "fr"),
    /overview, concepts, questions, unresolved/,
  );
  assert.match(prompt("Meeting", "es"), /valid JSON/);
  assert.match(prompt("Meeting", "auto"), /transcript language/);
  const output = formatGrounded(
    "The concept is recursion.",
    "bad",
    "Lecture",
    "fr",
  );
  assert.match(output, /Concepts clés/);
  assert.doesNotMatch(output, /## Actions/);
});
test("suggestions cannot become structured action items and arbitrary date mentions cannot become deadlines", () => {
  const source = "Ana: We should test billing on October 10.";
  const value = JSON.parse(
    structured("ASSIGNED", "We should test billing on October 10."),
  );
  value.sections[0].kind = "actions";
  assert.doesNotMatch(
    formatGrounded(source, JSON.stringify(value)),
    /ASSIGNED/,
  );
  const output = formatGrounded(
    "Ana: The date mentioned was October 10.",
    structured("DEADLINE", "The date mentioned was October 10.", {
      deadline: "October 10",
      deadlineQuote: "The date mentioned was October 10.",
    }),
  );
  assert.doesNotMatch(output, /DEADLINE/);
});
test("recorded local Spanish model fixture keeps valid prose and recovers translated metadata as source excerpts", () => {
  const source =
    "Ana: We agreed to launch on October 14. Priya: I will run the billing test on October 10.";
  const response = JSON.stringify({
    title: "Reunión de equipo",
    sections: [
      {
        kind: "overview",
        heading: "Resumen general",
        items: [
          {
            text: "Se acordó iniciar el lanzamiento el 14 de octubre.",
            evidence: [
              { quote: "We agreed to launch on October 14.", occurrence: 0 },
            ],
          },
        ],
      },
      {
        kind: "decisions",
        heading: "Decisiones tomadas",
        items: [
          {
            text: "Se decidió iniciar el lanzamiento el 14 de octubre.",
            evidence: [
              { quote: "We agreed to launch on October 14.", occurrence: 0 },
            ],
            deadline: "14 de octubre",
            deadlineQuote: "We agreed to launch on October 14.",
          },
        ],
      },
      {
        kind: "actions",
        heading: "Acciones asignadas",
        items: [
          {
            text: "Priya se encargará de ejecutar la prueba.",
            evidence: [
              {
                quote: "I will run the billing test on October 10.",
                occurrence: 0,
              },
            ],
            deadline: "10 de octubre",
            deadlineQuote: "I will run the billing test on October 10.",
          },
        ],
      },
    ],
  });
  const output = formatGrounded(source, response, "Meeting", "es");
  assert.match(output, /Resumen general\n- Se acordó/);
  assert.match(output, /Decisiones tomadas\n- Ana: “We agreed/);
  assert.match(output, /Acciones asignadas\n- Priya: “I will run/);
  assert.doesNotMatch(output, /Se decidió|Priya se encargará/);
});
