type Person = "ava" | "ben" | "cora";
type Item = "key" | "badge" | "orb" | "map";
type Location = "atrium" | "lab" | "vault" | "garden";
type Flag = "gate_open" | "alarm_armed" | "beacon_on";
type QueryKind =
  | "person_location"
  | "item_owner"
  | "item_location"
  | "item_sealed"
  | "flag_state";
type ChatRequestMode = "strict" | "relaxed" | "minimal";

type ProviderOverride = {
  only?: string[];
  order?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
};

type RequestOverride = {
  provider?: ProviderOverride;
  useResponseFormat?: boolean;
  useReasoningExclude?: boolean;
};

type OpenRouterChatResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | Array<{
        type?: string;
        text?: string;
      }>;
      reasoning?: string | Array<unknown>;
      reasoning_details?: Array<unknown>;
    };
  }>;
  provider?: string;
};

type OpenRouterContentPart = {
  type?: string;
  text?: string;
};

type OpenRouterMessageContent = string | OpenRouterContentPart[] | undefined;

type WorldState = {
  people: Record<Person, Location>;
  items: Record<
    Item,
    {
      owner: Person | null;
      location: Location | null;
      sealed: boolean;
    }
  >;
  flags: Record<Flag, boolean>;
};

type BaseAction =
  | {
      kind: "move";
      person: Person;
      to: Location;
    }
  | {
      kind: "take";
      person: Person;
      item: Item;
    }
  | {
      kind: "drop";
      person: Person;
      item: Item;
    }
  | {
      kind: "give";
      from: Person;
      to: Person;
      item: Item;
    }
  | {
      kind: "seal";
      person: Person;
      item: Item;
    }
  | {
      kind: "unseal";
      person: Person;
      item: Item;
    };

type Condition =
  | {
      kind: "person_at";
      person: Person;
      location: Location;
    }
  | {
      kind: "item_owned_by";
      item: Item;
      owner: Person;
    }
  | {
      kind: "item_at";
      item: Item;
      location: Location;
    }
  | {
      kind: "item_sealed";
      item: Item;
      value: boolean;
    }
  | {
      kind: "flag_state";
      flag: Flag;
      value: boolean;
    };

type ConditionalAction = {
  kind: "conditional";
  condition: Condition;
  action: BaseAction;
};

type UndoAction = {
  kind: "undo";
};

type EventAction = BaseAction | ConditionalAction | UndoAction;

type Query = {
  id: string;
  kind: QueryKind;
  prompt: string;
  answer: string;
};

type RNG = {
  nextFloat: () => number;
  pick: <T>(values: T[]) => T;
  shuffle: <T>(values: T[]) => T[];
  nextInt: (max: number) => number;
};

const PEOPLE: Person[] = ["ava", "ben", "cora"];
const ITEMS: Item[] = ["key", "badge", "orb", "map"];
const LOCATIONS: Location[] = ["atrium", "lab", "vault", "garden"];
const FLAGS: Flag[] = ["gate_open", "alarm_armed", "beacon_on"];
const CASE_COUNT = 16;
const EVENT_COUNT = 10;
const QUERY_COUNT = 4;
const MAX_GENERATION_ATTEMPTS = 5;

const providerOverrides: Record<string, RequestOverride> = {
  "minimax/minimax-m2.5": {
    provider: {
      allow_fallbacks: false,
      require_parameters: true,
    },
  },
};

export type WorldStateTrackingCase = {
  id: string;
  initialStateSummary: string;
  rulesSummary: string[];
  events: string[];
  queries: Query[];
};

export type WorldStateTrackingCaseResult = WorldStateTrackingCase & {
  expectedAnswers: string[];
  predictedAnswers: string[];
  exactQueryAccuracy: number;
  fullCaseMatch: boolean;
};

export async function runWorldStateTrackingBenchmark(
  modelId: string,
): Promise<{
  modelId: string;
  score: number;
  exactQueryAccuracy: number;
  fullCaseMatchRate: number;
  caseCount: number;
  queryCount: number;
  cases: WorldStateTrackingCaseResult[];
  promptTemplate: string;
}> {
  const cases = generateWorldStateTrackingCases();
  const promptTemplate = buildCasePrompt(cases[0], []);
  const results: WorldStateTrackingCaseResult[] = [];

  for (const testCase of cases) {
    const predictedAnswers = await answerQueries(modelId, testCase);
    const expectedAnswers = testCase.queries.map((query) => query.answer);
    const exactMatches = expectedAnswers.filter(
      (expected, index) => predictedAnswers[index] === expected,
    ).length;
    const exactQueryAccuracy = exactMatches / expectedAnswers.length;
    const fullCaseMatch = exactMatches === expectedAnswers.length;

    results.push({
      ...testCase,
      expectedAnswers,
      predictedAnswers,
      exactQueryAccuracy,
      fullCaseMatch,
    });
  }

  const exactQueryAccuracy =
    results.reduce((total, result) => total + result.exactQueryAccuracy, 0) /
    results.length;
  const fullCaseMatchRate =
    results.filter((result) => result.fullCaseMatch).length / results.length;

  return {
    modelId,
    score: exactQueryAccuracy,
    exactQueryAccuracy,
    fullCaseMatchRate,
    caseCount: results.length,
    queryCount: QUERY_COUNT,
    cases: results,
    promptTemplate,
  };
}

function generateWorldStateTrackingCases(): WorldStateTrackingCase[] {
  return Array.from({ length: CASE_COUNT }, (_, index) =>
    createCase(`world-${index + 1}`, index + 1),
  );
}

function createCase(id: string, seed: number): WorldStateTrackingCase {
  const rng = createRng(seed * 104729);
  const initialState = createInitialWorldState(rng);
  let state = structuredClone(initialState);
  const rulesSummary = getRulesSummary();
  const events: string[] = [];
  const history: WorldState[] = [];

  for (let index = 0; index < EVENT_COUNT; index += 1) {
    const nextEvent = sampleEvent(state, history, rng);
    events.push(renderEvent(nextEvent));
    state = applyEvent(state, nextEvent, history);
  }

  const queries = buildQueries(state, rng);

  return {
    id,
    initialStateSummary: renderInitialState(initialState),
    rulesSummary,
    events,
    queries,
  };
}

function createInitialWorldState(rng: RNG): WorldState {
  const peopleLocations = rng.shuffle(LOCATIONS);
  const itemLocations = rng.shuffle(LOCATIONS);
  const items = Object.fromEntries(
    ITEMS.map((item, index) => [
      item,
      {
        owner: null,
        location: itemLocations[index % itemLocations.length],
        sealed: rng.nextFloat() < 0.5,
      },
    ]),
  ) as WorldState["items"];
  const state: WorldState = {
    people: {
      ava: peopleLocations[0],
      ben: peopleLocations[1],
      cora: peopleLocations[2],
    },
    items,
    flags: {
      gate_open: false,
      alarm_armed: true,
      beacon_on: false,
    },
  };

  return syncDerivedFlags(state);
}

function sampleEvent(
  state: WorldState,
  history: WorldState[],
  rng: RNG,
): EventAction {
  const legalBaseActions = getLegalBaseActions(state);
  const allowUndo = history.length > 0;
  const roll = rng.nextFloat();

  if (allowUndo && roll < 0.18) {
    return { kind: "undo" };
  }

  if (roll < 0.5) {
    return {
      kind: "conditional",
      condition: sampleCondition(state, rng),
      action: rng.pick(legalBaseActions),
    };
  }

  return rng.pick(legalBaseActions);
}

function applyEvent(
  state: WorldState,
  event: EventAction,
  history: WorldState[],
): WorldState {
  if (event.kind === "undo") {
    const previous = history.pop();
    return previous ? structuredClone(previous) : state;
  }

  if (event.kind === "conditional") {
    if (!evaluateCondition(state, event.condition)) {
      return state;
    }

    history.push(structuredClone(state));
    return applyBaseAction(state, event.action);
  }

  history.push(structuredClone(state));
  return applyBaseAction(state, event);
}

function applyBaseAction(state: WorldState, action: BaseAction): WorldState {
  const nextState = structuredClone(state);

  switch (action.kind) {
    case "move":
      nextState.people[action.person] = action.to;
      break;
    case "take":
      nextState.items[action.item].owner = action.person;
      nextState.items[action.item].location = null;
      break;
    case "drop":
      nextState.items[action.item].owner = null;
      nextState.items[action.item].location = nextState.people[action.person];
      break;
    case "give":
      nextState.items[action.item].owner = action.to;
      nextState.items[action.item].location = null;
      break;
    case "seal":
      nextState.items[action.item].sealed = true;
      break;
    case "unseal":
      nextState.items[action.item].sealed = false;
      break;
  }

  return syncDerivedFlags(nextState);
}

function syncDerivedFlags(state: WorldState): WorldState {
  const nextState = structuredClone(state);
  nextState.flags.gate_open = nextState.items.key.owner !== null;
  nextState.flags.alarm_armed = getResolvedItemLocation(nextState, "badge") !== "vault";
  nextState.flags.beacon_on =
    nextState.items.orb.sealed === false &&
    getResolvedItemLocation(nextState, "orb") === "lab";
  return nextState;
}

function getLegalBaseActions(state: WorldState): BaseAction[] {
  const actions: BaseAction[] = [];

  for (const person of PEOPLE) {
    for (const location of LOCATIONS) {
      if (state.people[person] !== location) {
        actions.push({ kind: "move", person, to: location });
      }
    }
  }

  for (const person of PEOPLE) {
    for (const item of ITEMS) {
      const itemState = state.items[item];
      const personLocation = state.people[person];
      const accessible =
        itemState.owner === person ||
        (itemState.owner === null && itemState.location === personLocation);

      if (itemState.owner === null && itemState.location === personLocation) {
        actions.push({ kind: "take", person, item });
      }

      if (itemState.owner === person) {
        actions.push({ kind: "drop", person, item });

        for (const otherPerson of PEOPLE) {
          if (
            otherPerson !== person &&
            state.people[otherPerson] === personLocation
          ) {
            actions.push({
              kind: "give",
              from: person,
              to: otherPerson,
              item,
            });
          }
        }
      }

      if (accessible && itemState.sealed) {
        actions.push({ kind: "unseal", person, item });
      }

      if (accessible && !itemState.sealed) {
        actions.push({ kind: "seal", person, item });
      }
    }
  }

  return actions;
}

function sampleCondition(state: WorldState, rng: RNG): Condition {
  const pool: Condition[] = [
    ...PEOPLE.flatMap((person) =>
      LOCATIONS.map((location) => ({
        kind: "person_at" as const,
        person,
        location,
      })),
    ),
    ...ITEMS.flatMap((item) =>
      PEOPLE.map((owner) => ({
        kind: "item_owned_by" as const,
        item,
        owner,
      })),
    ),
    ...ITEMS.flatMap((item) =>
      LOCATIONS.map((location) => ({
        kind: "item_at" as const,
        item,
        location,
      })),
    ),
    ...ITEMS.flatMap((item) => [
      {
        kind: "item_sealed" as const,
        item,
        value: true,
      },
      {
        kind: "item_sealed" as const,
        item,
        value: false,
      },
    ]),
    ...FLAGS.flatMap((flag) => [
      {
        kind: "flag_state" as const,
        flag,
        value: true,
      },
      {
        kind: "flag_state" as const,
        flag,
        value: false,
      },
    ]),
  ];

  return rng.pick(pool);
}

function evaluateCondition(state: WorldState, condition: Condition): boolean {
  switch (condition.kind) {
    case "person_at":
      return state.people[condition.person] === condition.location;
    case "item_owned_by":
      return state.items[condition.item].owner === condition.owner;
    case "item_at":
      return getResolvedItemLocation(state, condition.item) === condition.location;
    case "item_sealed":
      return state.items[condition.item].sealed === condition.value;
    case "flag_state":
      return state.flags[condition.flag] === condition.value;
  }
}

function buildQueries(state: WorldState, rng: RNG): Query[] {
  const queryPool: Query[] = [
    ...PEOPLE.map((person) => ({
      id: `where-${person}`,
      kind: "person_location" as const,
      prompt: `where is ${person}?`,
      answer: state.people[person],
    })),
    ...ITEMS.map((item) => ({
      id: `owner-${item}`,
      kind: "item_owner" as const,
      prompt: `who has ${item}?`,
      answer: state.items[item].owner ?? "nobody",
    })),
    ...ITEMS.map((item) => ({
      id: `location-${item}`,
      kind: "item_location" as const,
      prompt: `where is ${item}?`,
      answer: getResolvedItemLocation(state, item),
    })),
    ...ITEMS.map((item) => ({
      id: `sealed-${item}`,
      kind: "item_sealed" as const,
      prompt: `is ${item} sealed?`,
      answer: state.items[item].sealed ? "yes" : "no",
    })),
    ...FLAGS.map((flag) => ({
      id: `flag-${flag}`,
      kind: "flag_state" as const,
      prompt: `is ${renderFlagName(flag)}?`,
      answer: state.flags[flag] ? "yes" : "no",
    })),
  ];

  return rng
    .shuffle(queryPool)
    .slice(0, QUERY_COUNT)
    .map((query, index) => ({
      ...query,
      id: `query-${index + 1}`,
    }));
}

function renderInitialState(state: WorldState): string {
  const peopleSummary = PEOPLE.map(
    (person) => `${person} is in ${state.people[person]}`,
  ).join("; ");
  const itemSummary = ITEMS.map((item) => {
    const owner = state.items[item].owner;
    const location = owner ? `with ${owner}` : `in ${state.items[item].location}`;
    const sealed = state.items[item].sealed ? "sealed" : "unsealed";
    return `${item} is ${location} and ${sealed}`;
  }).join("; ");

  return `${peopleSummary}. ${itemSummary}.`;
}

function getRulesSummary(): string[] {
  return [
    "The gate is open if and only if someone owns the key.",
    "The alarm is armed unless the badge is in the vault, including if someone carrying it is in the vault.",
    "The beacon is on if and only if the orb is unsealed and in the lab, including if someone carrying it is in the lab.",
    "Undo means revert the previous state-changing event.",
  ];
}

function renderEvent(event: EventAction): string {
  if (event.kind === "undo") {
    return "undo the previous state-changing event.";
  }

  if (event.kind === "conditional") {
    return `if ${renderCondition(event.condition)}, then ${renderBaseAction(event.action)}.`;
  }

  return `${renderBaseAction(event)}.`;
}

function renderBaseAction(action: BaseAction): string {
  switch (action.kind) {
    case "move":
      return `${action.person} moves to ${action.to}`;
    case "take":
      return `${action.person} takes the ${action.item}`;
    case "drop":
      return `${action.person} drops the ${action.item}`;
    case "give":
      return `${action.from} gives the ${action.item} to ${action.to}`;
    case "seal":
      return `${action.person} seals the ${action.item}`;
    case "unseal":
      return `${action.person} unseals the ${action.item}`;
  }
}

function renderCondition(condition: Condition): string {
  switch (condition.kind) {
    case "person_at":
      return `${condition.person} is in ${condition.location}`;
    case "item_owned_by":
      return `${condition.owner} has the ${condition.item}`;
    case "item_at":
      return `the ${condition.item} is in ${condition.location}`;
    case "item_sealed":
      return `the ${condition.item} is ${condition.value ? "sealed" : "unsealed"}`;
    case "flag_state":
      return `${renderFlagName(condition.flag)} is ${condition.value ? "true" : "false"}`;
  }
}

function renderFlagName(flag: Flag): string {
  switch (flag) {
    case "gate_open":
      return "the gate open";
    case "alarm_armed":
      return "the alarm armed";
    case "beacon_on":
      return "the beacon on";
  }
}

function getResolvedItemLocation(state: WorldState, item: Item): Location {
  const itemState = state.items[item];

  if (itemState.owner) {
    return state.people[itemState.owner];
  }

  return itemState.location ?? "atrium";
}

async function answerQueries(
  modelId: string,
  testCase: WorldStateTrackingCase,
): Promise<string[]> {
  let bestAnswers: string[] = [];

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const data = await requestChatCompletion({
      modelId,
      prompt:
        attempt === 1
          ? buildCasePrompt(testCase, [])
          : buildCasePrompt(testCase, bestAnswers),
    });
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = extractTextContent(message?.content);

    if (!content) {
      logAnswerAttemptFailure({
        modelId,
        caseId: testCase.id,
        attempt,
        reason: "missing_content",
        finishReason: choice?.finish_reason,
        provider: data.provider,
        contentType: describeContentShape(message?.content),
        hasReasoning: Boolean(message?.reasoning),
        hasReasoningDetails: Boolean(message?.reasoning_details?.length),
      });
      continue;
    }

    const answers = normalizeAnswerList(content);

    if (answers.length === 0) {
      logAnswerAttemptFailure({
        modelId,
        caseId: testCase.id,
        attempt,
        reason: "unparseable_content",
        finishReason: choice?.finish_reason,
        provider: data.provider,
        contentType: describeContentShape(message?.content),
        hasReasoning: Boolean(message?.reasoning),
        hasReasoningDetails: Boolean(message?.reasoning_details?.length),
        rawPreview: content.slice(0, 240),
      });
      continue;
    }

    if (answers.length > bestAnswers.length) {
      bestAnswers = answers;
    }

    if (answers.length === QUERY_COUNT) {
      return answers;
    }

    logAnswerAttemptFailure({
      modelId,
      caseId: testCase.id,
      attempt,
      reason: "partial_answer_set",
      finishReason: choice?.finish_reason,
      provider: data.provider,
      contentType: describeContentShape(message?.content),
      hasReasoning: Boolean(message?.reasoning),
      hasReasoningDetails: Boolean(message?.reasoning_details?.length),
      rawPreview: content.slice(0, 240),
    });
  }

  throw new Error(`Failed to parse ${QUERY_COUNT} answers for case ${testCase.id}.`);
}

function buildCasePrompt(
  testCase: WorldStateTrackingCase,
  partialAnswers: string[],
): string {
  return [
    "Track the world state exactly.",
    "Read the initial state, rules, and events in order, including undo and conditional events.",
    `Answer exactly ${QUERY_COUNT} queries.`,
    "Return only JSON in the form {\"answers\":[...]} or a JSON array.",
    "Use only these answer formats: location names, person names, nobody, yes, or no.",
    `Initial state: ${testCase.initialStateSummary}`,
    `Rules: ${testCase.rulesSummary.join(" ")}`,
    `Events: ${testCase.events.map((event, index) => `${index + 1}. ${event}`).join(" ")}`,
    `Queries: ${testCase.queries
      .map((query, index) => `${index + 1}. ${query.prompt}`)
      .join(" ")}`,
    ...(partialAnswers.length > 0
      ? [
          `Your previous partial answer set was: ${JSON.stringify(partialAnswers)}.`,
          "Return the complete answer list, not just the missing suffix.",
        ]
      : []),
  ].join(" ");
}

function normalizeAnswerList(content: string): string[] {
  const normalizedContent = stripMarkdownFences(content).trim();

  try {
    return sanitizeAnswers(extractAnswerValues(JSON.parse(normalizedContent)));
  } catch {
    const jsonCandidate = extractJsonCandidate(normalizedContent);

    if (jsonCandidate) {
      try {
        return sanitizeAnswers(extractAnswerValues(JSON.parse(jsonCandidate)));
      } catch {
        // Fall through to loose parsing.
      }
    }
  }

  return sanitizeAnswers(
    normalizedContent
      .replace(/^\s*\[|\]\s*$/g, "")
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function extractAnswerValues(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object") {
    const object = parsed as Record<string, unknown>;

    for (const key of ["answers", "items", "response", "prediction", "answer"]) {
      if (Array.isArray(object[key])) {
        return object[key];
      }
    }
  }

  return [];
}

function sanitizeAnswers(values: unknown[]): string[] {
  return values
    .map((value) => String(value).trim().toLowerCase())
    .map((value) => value.replace(/^['"]+|['"]+$/g, ""))
    .map((value) => value.replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, QUERY_COUNT);
}

function buildChatRequest(input: {
  modelId: string;
  prompt: string;
  mode: ChatRequestMode;
}): Record<string, unknown> {
  const requestOverride = getRequestOverride(input.modelId);
  const useResponseFormat =
    input.mode === "strict"
      ? requestOverride.useResponseFormat !== false
      : false;
  const useReasoningExclude =
    input.mode === "minimal"
      ? false
      : requestOverride.useReasoningExclude !== false;
  const requireParameters =
    input.mode === "strict"
      ? requestOverride.provider?.require_parameters ?? true
      : false;

  return {
    model: input.modelId,
    messages: [
      {
        role: "user",
        content: input.prompt,
      },
    ],
    temperature: 0,
    ...(useReasoningExclude
      ? {
          reasoning: {
            exclude: true,
          },
        }
      : {}),
    ...(useResponseFormat
      ? {
          response_format: {
            type: "json_object",
          },
        }
      : {}),
    provider: {
      require_parameters: requireParameters,
      ...(requestOverride.provider ?? {}),
    },
  };
}

async function requestChatCompletion(input: {
  modelId: string;
  prompt: string;
}): Promise<OpenRouterChatResponse> {
  const modes: ChatRequestMode[] = ["strict", "relaxed", "minimal"];
  let lastError: Error | null = null;

  for (const mode of modes) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: getOpenRouterHeaders(),
      body: JSON.stringify(
        buildChatRequest({
          modelId: input.modelId,
          prompt: input.prompt,
          mode,
        }),
      ),
    });

    if (response.ok) {
      return (await response.json()) as OpenRouterChatResponse;
    }

    const errorText = await response.text();

    if (
      response.status === 404 &&
      errorText.includes("requested parameters") &&
      mode !== "minimal"
    ) {
      lastError = new Error(
        `OpenRouter chat request failed in ${mode} mode: ${response.status} ${errorText}`,
      );
      continue;
    }

    throw new Error(
      `OpenRouter chat request failed: ${response.status} ${errorText}`,
    );
  }

  throw lastError ?? new Error("OpenRouter chat request failed in all modes.");
}

function getRequestOverride(modelId: string): RequestOverride {
  if (providerOverrides[modelId]) {
    return providerOverrides[modelId];
  }

  if (modelId.startsWith("amazon/nova-")) {
    return {
      useResponseFormat: false,
      useReasoningExclude: false,
      provider: {
        require_parameters: false,
      },
    };
  }

  return {};
}

function stripMarkdownFences(content: string): string {
  return content
    .replace(/^```[a-zA-Z0-9_-]*\s*/g, "")
    .replace(/\s*```$/g, "")
    .trim();
}

function extractJsonCandidate(content: string): string | null {
  const arrayMatch = content.match(/\[[\s\S]*\]/);

  if (arrayMatch) {
    return arrayMatch[0];
  }

  const objectMatch = content.match(/\{[\s\S]*\}/);

  if (objectMatch) {
    return objectMatch[0];
  }

  return null;
}

function extractTextContent(content: OpenRouterMessageContent): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function describeContentShape(content: OpenRouterMessageContent): string {
  if (typeof content === "string") {
    return "string";
  }

  if (Array.isArray(content)) {
    return "array";
  }

  if (content == null) {
    return "empty";
  }

  return typeof content;
}

function logAnswerAttemptFailure(details: {
  modelId: string;
  caseId: string;
  attempt: number;
  reason: string;
  finishReason?: string | null;
  provider?: string;
  contentType: string;
  hasReasoning: boolean;
  hasReasoningDetails: boolean;
  rawPreview?: string;
}): void {
  console.warn(
    JSON.stringify(
      {
        event: "world_state_tracking_attempt_failed",
        ...details,
      },
      null,
      2,
    ),
  );
}

function getOpenRouterHeaders(): HeadersInit {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required.");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function createRng(seed: number): RNG {
  let value = seed >>> 0;

  return {
    nextFloat() {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 0x100000000;
    },
    nextInt(max: number) {
      return Math.floor(this.nextFloat() * max);
    },
    pick<T>(values: T[]) {
      return values[this.nextInt(values.length)];
    },
    shuffle<T>(values: T[]) {
      const result = values.slice();

      for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = this.nextInt(index + 1);
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
      }

      return result;
    },
  };
}
