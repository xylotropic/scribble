"use strict";
const { extractiveSummary } = require("./ai");
function prompt(template = "Meeting", language = "en") {
  return `Create evidence-only ${template} notes in ${language}. Use Markdown bullet lists under Overview, Decisions, Action items, and Unresolved. Each bullet must include a short exact quote from the transcript as evidence. Never infer events, relative dates, task assignments or deadlines. An action item requires a speaker explicitly committing to a task, for example I will, or I need to. Quote that commitment and name only that speaker as owner. A speaker reporting an undecided issue has not committed to resolve it: put that issue only under Unresolved, and retain any statement that its owner is unassigned. Retain tentative words such as might. Decisions require an explicit agreed or decided statement. Use concise bullets, no narrative overview and no analysis.`;
}
function formatGrounded(transcript, response, template = "Meeting") {
  const source = String(transcript),
    facts = [];
  // Only actual transcript excerpts may become summary facts. Model prose never assigns an owner.
  for (const match of String(response).matchAll(
    /"([^"\n]{8,})"|“([^”\n]{8,})”/g,
  )) {
    const quote = (match[1] || match[2]).trim(),
      offset = source.indexOf(quote);
    if (offset < 0 || facts.some((f) => f.quote === quote)) continue;
    const before = source.slice(0, offset),
      speaker = [
        ...before.matchAll(
          /(?:^|[.!?]\s+|\n)([\p{L}][\p{L}\p{N} .'-]{0,50}):\s*/gu,
        ),
      ]
        .at(-1)?.[1]
        ?.trim();
    facts.push({ quote, speaker });
  }
  if (!facts.length) return extractiveSummary(source, template);
  const groups = {
    Overview: [],
    Decisions: [],
    "Action items": [],
    Unresolved: [],
  };
  for (const fact of facts) {
    const quote = fact.quote;
    const group =
      /\b(might|may|not decided|undecided|no owner|unassigned|not been assigned|uncertain)\b/i.test(
        quote,
      )
        ? "Unresolved"
        : /\b(agreed|decided|approved|chosen)\b/i.test(quote)
          ? "Decisions"
          : /\b(I will|I need to|I am going to|I'll)\b/i.test(quote)
            ? "Action items"
            : "Overview";
    groups[group].push(
      `- ${fact.speaker ? fact.speaker + ": " : ""}“${quote}”`,
    );
  }
  if (!groups.Overview.length) groups.Overview.push("- " + facts[0].quote);
  return (
    `# ${template} notes\n\n` +
    Object.entries(groups)
      .map(
        ([title, bullets]) =>
          `## ${title}\n${bullets.length ? bullets.join("\n") : "No explicit evidence recorded."}`,
      )
      .join("\n\n")
  );
}
module.exports = { prompt, formatGrounded };
