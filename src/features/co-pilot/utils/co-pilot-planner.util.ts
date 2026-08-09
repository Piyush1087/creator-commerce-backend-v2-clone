export type PlannerCardCandidate = {
  id: string;
  aiContextHook?: string | null;
  strategy?: { objective?: string | null };
};

export function mentionsPlanner(text: string): boolean {
  const n = text.toLowerCase();
  if (
    n.includes("campaign planner") ||
    n.includes("planner board") ||
    n.includes("planner pipeline") ||
    n.includes("to planner")
  ) {
    return true;
  }
  return /pl+a+n+[ea]?r/i.test(n) || n.includes("plabnn") || n.includes("plannert");
}

export function isPlannerPipelineReadQuery(userText: string): boolean {
  const n = userText.toLowerCase();

  if (!mentionsPlanner(userText)) {
    return false;
  }

  if (
    /\b(list|show|see|view|what|which|how many|display)\b/.test(n) &&
    (n.includes("card") || n.includes("blueprint") || n.includes("pipeline") || n.includes("board"))
  ) {
    return true;
  }

  return (
    n.includes("planner board") ||
    n.includes("planner pipeline") ||
    /\b(how many|pending|status|blueprint|draft)\b/.test(n)
  );
}

export function isPlannerLaunchGuidanceQuery(userText: string): boolean {
  const n = userText.toLowerCase();
  return (
    (mentionsPlanner(userText) || n.includes("launch")) &&
    (/\b(which|select|choose|how can i|how do i|how to)\b/.test(n) ||
      n.includes("which one") ||
      n.includes("select whihc") ||
      n.includes("select which"))
  );
}

export function isPlannerLaunchWriteQuery(userText: string): boolean {
  const n = userText.toLowerCase();

  // "move/send/push … planner" is move-leak, not launch-card.
  if (/\b(move|send|push|convert)\b/.test(n) && mentionsPlanner(userText)) {
    return false;
  }

  if (!mentionsPlanner(userText)) {
    return (
      n.includes("launch planner card") ||
      n.includes("create draft from planner")
    );
  }

  return (
    /\b(launch|approve|create draft)\b/.test(n) &&
    (n.includes("card") || n.includes("blueprint") || n.includes("my planner"))
  );
}

export function resolvePlannerCardFromContext(
  history: Array<{ role: "USER" | "ASSISTANT"; text: string }>,
  cards: PlannerCardCandidate[],
  userText: string,
): PlannerCardCandidate | undefined {
  const orderedTexts = [
    userText,
    ...history
      .slice()
      .reverse()
      .map((entry) => entry.text),
  ];

  for (const text of orderedTexts) {
    for (const card of cards) {
      const label = card.aiContextHook ?? card.strategy?.objective ?? "";
      if (label && text.includes(label)) {
        return card;
      }
    }
  }

  const n = userText.toLowerCase();
  if (
    (n.includes("my planner card") || n.includes("the planner card") || n.includes("ready")) &&
    cards.length === 1
  ) {
    return cards[0];
  }

  return undefined;
}

export function plannerCardLabel(card: PlannerCardCandidate): string {
  return card.aiContextHook ?? card.strategy?.objective ?? card.id;
}

export function buildPlannerLaunchGuidanceFooter(pendingCount: number): string {
  if (pendingCount === 0) {
    return "No green planner cards are waiting for launch. Move a leak to Campaign Planner first, then ask me to list planner cards.";
  }

  if (pendingCount === 1) {
    return 'To launch the pending card, say **Approve and launch my planner card as a draft campaign** — or tap **Launch planner card** below. I will stage it for your confirmation before creating a UCE DRAFT.';
  }

  return 'Pick a card from the table above, then say **Approve and launch my planner card** or use **Launch planner card** — I will show a picker if more than one green card is pending.';
}

export function buildPlannerReadyFollowUp(cardLabel: string): string {
  return [
    `Campaign Planner card is ready: "${cardLabel}".`,
    "",
    'Next step: say **Approve and launch my planner card as a draft campaign** (or use the **Launch planner card** suggestion). I will stage the launch for your confirmation before creating a UCE DRAFT.',
  ].join("\n");
}
