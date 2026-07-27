import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ABLATION_PROFILE_HASH } from "../../dist/toolchain/src/index.js";
import { contentHash, stableJson } from "../lib/stable.mjs";

const root = resolve(import.meta.dirname, "../..");

const writeJson = async (path, value) => {
  const target = resolve(root, path);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeText = async (path, value) => {
  const target = resolve(root, path);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, value, "utf8");
};

const seedFiles = {
  "src/capabilities.volt": `module capabilities

import domain.{Registration, StoreError}

pub effect RegistrationStore {
  fn find(event_id: Int, person_id: Int) -> Option<Registration>
  fn save(registration: Registration) -> Result<Unit, StoreError>
}

pub effect Clock {
  fn now() -> Int
}

pub effect Notification {
  fn send(message: String) -> Unit
}
`,
  "src/domain.volt": `module domain

pub type EventState {
  Open
  Closed
}

pub type RegistrationError {
  EventFull
  AlreadyRegistered
  RegistrationClosed
  StoreFailed
}

pub type StoreError {
  Unavailable
}

pub record Event {
  id: Int,
  capacity: Int,
  registered: Int,
  state: EventState
}

pub record Person {
  id: Int,
  name: String
}

pub record Registration {
  event_id: Int,
  person_id: Int,
  created_at: Int
}

pub record AuditStamp {
  value: Int
}
`,
  "src/registration_service.volt": `module registration_service

import capabilities.{Clock, RegistrationStore}
import domain.{Event, EventState, Person, Registration, RegistrationError}

pub fn within_capacity(event: Event) -> Bool {
  event.registered < event.capacity
}

pub fn registration_code() -> Int {
  1
}

pub fn event_code(event: Event) -> Int {
  match event.state {
    Open -> 1
    Closed -> 0
  }
}

pub fn person_code(person: Person) -> Int {
  person.id
}

pub fn calibration_code() -> Int {
  7
}

pub fn register(event: Event, person: Person)
  uses {Clock, RegistrationStore}
  -> Result<Registration, RegistrationError> {
  match RegistrationStore.find(event.id, person.id) {
    Some(existing) -> Error(AlreadyRegistered)
    None -> match event.state {
      Open -> if event.registered >= event.capacity {
        Error(EventFull)
      } else {
        let registration = Registration {
          event_id: event.id,
          person_id: person.id,
          created_at: Clock.now()
        } in
        match RegistrationStore.save(registration) {
          Ok(saved) -> Ok(registration)
          Error(store_error) -> Error(StoreFailed)
        }
      }
      Closed -> Error(RegistrationClosed)
    }
  }
}
`,
  "src/tests.volt": `module tests

import capabilities.{Clock, RegistrationStore}
import domain.{Event, EventState, Person}
import registration_service.{register}

pub fn registration_test()
  uses {Clock, RegistrationStore}
  -> Result<Unit, String> {
  let event = Event { id: 1, capacity: 2, registered: 0, state: Open } in
  let person = Person { id: 7, name: "Ada" } in
  match register(event, person) {
    Ok(registration) -> Ok(())
    Error(problem) -> Error("registration failed")
  }
}
`,
  "volt.json": `${JSON.stringify({
    schemaVersion: 1,
    sourceRoot: "src",
    run: "tests.registration_test",
    tests: ["tests.registration_test"],
    capabilities: [
      { effect: "capabilities::effect::RegistrationStore", adapter: "database" },
      { effect: "capabilities::effect::Clock", adapter: "clock", config: { values: [100] } },
      { effect: "capabilities::effect::Notification", adapter: "notification" }
    ]
  }, null, 2)}\n`
};

function replace(files, path, before, after) {
  const source = files[path];
  assert.equal(typeof source, "string", `missing source file: ${path}`);
  assert(source.includes(before), `replacement source not found in ${path}: ${JSON.stringify(before)}`);
  return { ...files, [path]: source.replace(before, after) };
}

function addState(files, variant) {
  let next = replace(
    files,
    "src/domain.volt",
    "  Open\n  Closed",
    `  Open\n  Closed\n  ${variant}`
  );
  next = replace(
    next,
    "src/registration_service.volt",
    "    Closed -> 0",
    `    Closed -> 0\n    ${variant} -> 0`
  );
  next = replace(
    next,
    "src/registration_service.volt",
    "      Closed -> Error(RegistrationClosed)",
    `      Closed -> Error(RegistrationClosed)\n      ${variant} -> Error(RegistrationClosed)`
  );
  return next;
}

function addRegistrationField(files, field, value) {
  let next = replace(
    files,
    "src/domain.volt",
    "  person_id: Int,\n  created_at: Int",
    `  person_id: Int,\n  ${field}: Int,\n  created_at: Int`
  );
  next = replace(
    next,
    "src/registration_service.volt",
    "          person_id: person.id,\n          created_at: Clock.now()",
    `          person_id: person.id,\n          ${field}: ${value},\n          created_at: Clock.now()`
  );
  return next;
}

function addPersonField(files, field, value) {
  let next = replace(
    files,
    "src/domain.volt",
    "  id: Int,\n  name: String\n}",
    `  id: Int,\n  name: String,\n  ${field}: Int\n}`
  );
  next = replace(
    next,
    "src/tests.volt",
    "Person { id: 7, name: \"Ada\" }",
    `Person { id: 7, name: "Ada", ${field}: ${value} }`
  );
  return next;
}

function contractChange(files, functionName, beforeParams, afterParams, beforeExpression, afterExpression) {
  let next = replace(
    files,
    "src/registration_service.volt",
    `pub fn ${functionName}(${beforeParams})`,
    `pub fn ${functionName}(${afterParams})`
  );
  next = replace(next, "src/registration_service.volt", beforeExpression, afterExpression);
  return next;
}

function addNotificationEffect(files, functionName, parameterText, returnType, originalBody, message) {
  let next = replace(
    files,
    "src/registration_service.volt",
    "import capabilities.{Clock, RegistrationStore}",
    "import capabilities.{Clock, Notification, RegistrationStore}"
  );
  next = replace(
    next,
    "src/registration_service.volt",
    `pub fn ${functionName}(${parameterText}) -> ${returnType} {\n  ${originalBody}\n}`,
    `pub fn ${functionName}(${parameterText}) uses {Notification} -> ${returnType} {\n  let sent = Notification.send("${message}") in\n  ${originalBody}\n}`
  );
  return next;
}

function changeRegisterContract(files) {
  let next = replace(
    files,
    "src/registration_service.volt",
    "pub fn register(event: Event, person: Person)",
    "pub fn register(event: Event, person: Person, request_id: Int)"
  );
  next = replace(
    next,
    "src/registration_service.volt",
    "created_at: Clock.now()",
    "created_at: Clock.now() + request_id - request_id"
  );
  next = replace(
    next,
    "src/tests.volt",
    "register(event, person)",
    "register(event, person, 99)"
  );
  return next;
}

function moveAuditStamp(files) {
  let next = replace(
    files,
    "src/domain.volt",
    "\npub record AuditStamp {\n  value: Int\n}\n",
    "\n"
  );
  next = replace(
    next,
    "src/capabilities.volt",
    "\npub effect RegistrationStore",
    "\npub record AuditStamp {\n  value: Int\n}\n\npub effect RegistrationStore"
  );
  return next;
}

const operations = {
  calibration_state_extension: {
    corpus: "calibration",
    family: "state_extension",
    category: "adt_variant",
    wording: "Add the Paused event state and preserve closed-registration behavior.",
    files: ["src/domain.volt", "src/registration_service.volt"],
    targetFile: "src/domain.volt",
    targetText: "  Paused",
    apply: (files) => addState(files, "Paused")
  },
  calibration_invariant_change: {
    corpus: "calibration",
    family: "invariant_change",
    category: "function_contract",
    wording: "Require a minimum person identifier in person_code without weakening existing registration checks.",
    files: ["src/registration_service.volt"],
    targetFile: "src/registration_service.volt",
    targetText: "minimum_id: Int",
    apply: (files) => contractChange(
      files,
      "person_code",
      "person: Person",
      "person: Person, minimum_id: Int",
      "  person.id\n}",
      "  if person.id >= minimum_id { person.id } else { 0 }\n}"
    )
  },
  calibration_effect_addition: {
    corpus: "calibration",
    family: "effect_addition",
    category: "effect_set",
    wording: "Make calibration_code announce its use through Notification.",
    files: ["src/registration_service.volt"],
    targetFile: "src/registration_service.volt",
    targetText: "calibration_code() uses {Notification}",
    apply: (files) => addNotificationEffect(files, "calibration_code", "", "Int", "7", "calibration")
  },
  calibration_cross_module_contract_change: {
    corpus: "calibration",
    family: "cross_module_contract_change",
    category: "function_contract",
    wording: "Add an offset parameter to registration_code and preserve all registration behavior.",
    files: ["src/registration_service.volt"],
    targetFile: "src/registration_service.volt",
    targetText: "registration_code(offset: Int)",
    apply: (files) => contractChange(
      files,
      "registration_code",
      "",
      "offset: Int",
      "  1\n}",
      "  1 + offset\n}"
    )
  },
  state_extension_1: {
    corpus: "confirmatory",
    family: "state_extension",
    category: "adt_variant",
    wording: "Add Waitlisted to EventState and update every exhaustive match.",
    files: ["src/domain.volt", "src/registration_service.volt"],
    targetFile: "src/domain.volt",
    targetText: "  Waitlisted",
    apply: (files) => addState(files, "Waitlisted")
  },
  state_extension_2: {
    corpus: "confirmatory",
    family: "state_extension",
    category: "record_field",
    wording: "Add a source_code field to Registration and propagate every constructor.",
    files: ["src/domain.volt", "src/registration_service.volt"],
    targetFile: "src/domain.volt",
    targetText: "  source_code: Int",
    apply: (files) => addRegistrationField(files, "source_code", "1")
  },
  state_extension_3: {
    corpus: "confirmatory",
    family: "state_extension",
    category: "adt_variant",
    wording: "Add Cancelled to EventState and preserve all non-open rejection behavior.",
    files: ["src/domain.volt", "src/registration_service.volt"],
    targetFile: "src/domain.volt",
    targetText: "  Cancelled",
    apply: (files) => addState(files, "Cancelled")
  },
  invariant_change_1: {
    corpus: "confirmatory",
    family: "invariant_change",
    category: "function_contract",
    wording: "Reserve capacity in within_capacity through an explicit reserve parameter.",
    files: ["src/registration_service.volt"],
    targetFile: "src/registration_service.volt",
    targetText: "reserve: Int",
    apply: (files) => contractChange(
      files,
      "within_capacity",
      "event: Event",
      "event: Event, reserve: Int",
      "  event.registered < event.capacity\n}",
      "  event.registered + reserve < event.capacity\n}"
    )
  },
  invariant_change_2: {
    corpus: "confirmatory",
    family: "invariant_change",
    category: "function_contract",
    wording: "Make registration_code accept a non-negative offset as an explicit contract input.",
    files: ["src/registration_service.volt"],
    targetFile: "src/registration_service.volt",
    targetText: "offset: Int",
    apply: (files) => contractChange(
      files,
      "registration_code",
      "",
      "offset: Int",
      "  1\n}",
      "  if offset >= 0 { 1 + offset } else { 1 }\n}"
    )
  },
  invariant_change_3: {
    corpus: "confirmatory",
    family: "invariant_change",
    category: "record_field",
    wording: "Add an age field to Person while preserving registration capacity and idempotency checks.",
    files: ["src/domain.volt", "src/tests.volt"],
    targetFile: "src/domain.volt",
    targetText: "  age: Int",
    apply: (files) => addPersonField(files, "age", "36")
  },
  effect_addition_1: {
    corpus: "confirmatory",
    family: "effect_addition",
    category: "effect_set",
    wording: "Declare and invoke Notification from registration_code.",
    files: ["src/registration_service.volt"],
    targetFile: "src/registration_service.volt",
    targetText: "registration_code() uses {Notification}",
    apply: (files) => addNotificationEffect(files, "registration_code", "", "Int", "1", "registration")
  },
  effect_addition_2: {
    corpus: "confirmatory",
    family: "effect_addition",
    category: "effect_set",
    wording: "Declare and invoke Notification from event_code.",
    files: ["src/registration_service.volt"],
    targetFile: "src/registration_service.volt",
    targetText: "event_code(event: Event) uses {Notification}",
    apply: (files) => addNotificationEffect(
      files,
      "event_code",
      "event: Event",
      "Int",
      "match event.state {\n    Open -> 1\n    Closed -> 0\n  }",
      "event"
    )
  },
  effect_addition_3: {
    corpus: "confirmatory",
    family: "effect_addition",
    category: "effect_set",
    wording: "Declare and invoke Notification from person_code.",
    files: ["src/registration_service.volt"],
    targetFile: "src/registration_service.volt",
    targetText: "person_code(person: Person) uses {Notification}",
    apply: (files) => addNotificationEffect(files, "person_code", "person: Person", "Int", "person.id", "person")
  },
  cross_module_contract_change_1: {
    corpus: "confirmatory",
    family: "cross_module_contract_change",
    category: "function_contract",
    wording: "Add a request_id parameter to register and update every caller.",
    files: ["src/registration_service.volt", "src/tests.volt"],
    targetFile: "src/registration_service.volt",
    targetText: "request_id: Int",
    apply: changeRegisterContract
  },
  cross_module_contract_change_2: {
    corpus: "confirmatory",
    family: "cross_module_contract_change",
    category: "module_move",
    wording: "Move AuditStamp from domain to capabilities without changing its public shape.",
    files: ["src/domain.volt", "src/capabilities.volt"],
    targetFile: "src/capabilities.volt",
    targetText: "pub record AuditStamp",
    apply: moveAuditStamp
  },
  cross_module_contract_change_3: {
    corpus: "confirmatory",
    family: "cross_module_contract_change",
    category: "function_contract",
    wording: "Add an explicit fallback parameter to event_code and preserve exhaustive state handling.",
    files: ["src/registration_service.volt"],
    targetFile: "src/registration_service.volt",
    targetText: "fallback: Int",
    apply: (files) => contractChange(
      files,
      "event_code",
      "event: Event",
      "event: Event, fallback: Int",
      "    Closed -> 0",
      "    Closed -> fallback"
    )
  }
};

function mutation(id, category, killedBy, path, source) {
  return {
    id: `${id}:mutant:${category}`,
    category,
    retained: true,
    killedBy: `${id}:${killedBy}`,
    sourceOverrides: { [path]: source }
  };
}

function taskMutations(id, operation, expectedFiles) {
  const servicePath = "src/registration_service.volt";
  const service = expectedFiles[servicePath];
  const targetSource = expectedFiles[operation.targetFile];
  const withoutTarget = targetSource.replace(operation.targetText, "");
  assert.notEqual(withoutTarget, targetSource, `target absent from expected solution: ${id}`);

  const incompletePath = operation.files.find((path) => path !== operation.targetFile);
  const incomplete = incompletePath === undefined || operation.category === "module_move"
    ? mutation(id, "incomplete_propagation", "requested_behavior", operation.targetFile, withoutTarget)
    : mutation(id, "incomplete_propagation", "compiles_full", incompletePath, seedFiles[incompletePath]);

  const weakened = service.replace(
    "event.registered >= event.capacity",
    "event.registered > event.capacity"
  );
  assert.notEqual(weakened, service);

  const effectBypass = operation.category === "effect_set"
    ? service.replace(" uses {Notification}", "")
    : service.replace("  uses {Clock, RegistrationStore}", "");
  assert.notEqual(effectBypass, service);

  const nonExhaustive = service.replace(/    Closed -> [^\n]+/u, "");
  assert.notEqual(nonExhaustive, service);

  const withNotificationImport = service.includes("import capabilities.{Clock, Notification, RegistrationStore}")
    ? service
    : service.replace(
        "import capabilities.{Clock, RegistrationStore}",
        "import capabilities.{Clock, Notification, RegistrationStore}"
      );
  const unnecessaryCapability = withNotificationImport.replace(
    "  uses {Clock, RegistrationStore}",
    "  uses {Clock, Notification, RegistrationStore}"
  );
  assert.notEqual(unnecessaryCapability, service);

  const unrelatedRegression = service.replace(
    "Closed -> Error(RegistrationClosed)",
    "Closed -> Error(EventFull)"
  );
  assert.notEqual(unrelatedRegression, service);
  const outputDrift = service.replace(
    "Error(store_error) -> Error(StoreFailed)",
    "Error(store_error) -> Error(EventFull)"
  );
  assert.notEqual(outputDrift, service);

  return {
    retained: [
      incomplete,
      mutation(id, "stale_contract", "requested_behavior", operation.targetFile, withoutTarget),
      mutation(id, "weakened_invariant", "preservation:capacity", servicePath, weakened),
      mutation(id, "effect_bypass", "compiles_full", servicePath, effectBypass),
      mutation(id, "non_exhaustive_change", "compiles_full", servicePath, nonExhaustive),
      mutation(id, "unnecessary_capability", "compiles_full", servicePath, unnecessaryCapability),
      mutation(id, "unrelated_regression", "runtime:registration_guarantees", servicePath, unrelatedRegression),
      mutation(id, "output_drift", "runtime:registration_guarantees", servicePath, outputDrift)
    ],
    excluded: [
      {
        id: `${id}:mutant:duplicated_invariant`,
        category: "duplicated_invariant",
        retained: false,
        removedReason: "Equivalent mutant: duplicating the same capacity predicate does not change observable behavior.",
        candidateHash: contentHash(service.replace(
          "event.registered >= event.capacity",
          "event.registered >= event.capacity || event.registered >= event.capacity"
        ))
      }
    ]
  };
}

const protocol = JSON.parse(await readFile(resolve(root, "research/protocol/protocol-v1.json"), "utf8"));
const kernel = JSON.parse(await readFile(resolve(root, "language/kernel/kernel-v0.json"), "utf8"));
const aliasManifest = {
  schemaVersion: 1,
  id: "volt-alias-treatment-v1",
  version: "1.0.0",
  aliases: [
    {
      alias: "public",
      canonical: "pub",
      documentationProminence: "equal",
      scope: "declaration_visibility"
    },
    {
      alias: "function",
      canonical: "fn",
      documentationProminence: "equal",
      scope: "function_declaration"
    },
    {
      alias: "effects",
      canonical: "uses",
      documentationProminence: "equal",
      scope: "function_effect_set"
    },
    {
      alias: "struct",
      canonical: "record",
      documentationProminence: "equal",
      scope: "record_declaration"
    }
  ]
};

const seed = {
  schemaVersion: 1,
  repositoryId: "event-registration-seed-v1",
  modules: ["domain", "registration_service", "capabilities", "tests"],
  capabilities: ["in_memory_database", "clock", "notification"],
  networkAllowed: false,
  files: seedFiles
};
const seedHash = contentHash(seed);

const tasks = Object.entries(operations)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([id, operation]) => {
    const expectedFiles = operation.apply(structuredClone(seedFiles));
    const expectedSolution = {
      schemaVersion: 1,
      taskId: id,
      files: expectedFiles
    };
    const mutations = taskMutations(id, operation, expectedFiles);
    return {
      schemaVersion: 1,
      id,
      corpus: operation.corpus,
      family: operation.family,
      publicChangeCategory: operation.category,
      mutationSeed: Number.parseInt(contentHash(id).slice(7, 15), 16),
      seedHash,
      expectedSolutionHash: contentHash(expectedSolution),
      publicTask: {
        wording: operation.wording,
        visibleFiles: Object.keys(seedFiles).sort(),
        publicTests: ["tests.registration_test"],
        allowedTools: ["inspect", "edit", "submit"],
        nonGoals: [
          "Do not add language features.",
          "Do not weaken capacity, idempotency, typed-failure, or effect guarantees.",
          "Do not access the network or external services."
        ]
      },
      expectedImpact: {
        files: [...operation.files].sort(),
        symbols: [`${id}::requested_change`],
        contracts: [`${operation.category}::${id}`],
        effects: operation.category === "effect_set" ? ["capabilities::effect::Notification"] : [],
        astObligations: [`${operation.category}::complete`],
        relatedTests: ["tests::function::registration_test"]
      },
      preservationAssertions: [
        {
          id: `${id}:preservation:registration_test`,
          description: "The preexisting registration test remains present.",
          file: "src/tests.volt"
        },
        {
          id: `${id}:preservation:capacity`,
          description: "Capacity remains a typed registration failure.",
          file: "src/registration_service.volt"
        },
        {
          id: `${id}:preservation:idempotency`,
          description: "Existing registrations remain idempotently rejected.",
          file: "src/registration_service.volt"
        }
      ],
      invariants: [
        {
          id: `${id}:requested_behavior`,
          kind: "static",
          hidden: true,
          assertion: {
            type: "source_contains",
            file: operation.targetFile,
            text: operation.targetText
          }
        },
        {
          id: `${id}:compiles_full`,
          kind: "static",
          hidden: true,
          assertion: { type: "compiles_full" }
        },
        {
          id: `${id}:contract_category`,
          kind: "static",
          hidden: true,
          assertion: {
            type: "public_change_category",
            category: operation.category
          }
        },
        {
          id: `${id}:runtime:registration_guarantees`,
          kind: "runtime",
          hidden: true,
          assertion: {
            type: "runtime_registration_scenarios"
          }
        },
        {
          id: `${id}:preservation:registration_test`,
          kind: "runtime",
          hidden: true,
          assertion: {
            type: "preserves_source",
            file: "src/tests.volt",
            text: "pub fn registration_test"
          }
        },
        {
          id: `${id}:preservation:capacity`,
          kind: "runtime",
          hidden: true,
          assertion: {
            type: "preserves_source",
            file: "src/registration_service.volt",
            text: "event.registered >= event.capacity"
          }
        },
        {
          id: `${id}:preservation:idempotency`,
          kind: "runtime",
          hidden: true,
          assertion: {
            type: "preserves_source",
            file: "src/registration_service.volt",
            text: "RegistrationStore.find(event.id, person.id)"
          }
        },
        {
          id: `${id}:preservation:typed_failures`,
          kind: "static",
          hidden: true,
          assertion: {
            type: "preserves_source",
            file: "src/registration_service.volt",
            text: "Result<Registration, RegistrationError>"
          }
        }
      ],
      mutations: mutations.retained,
      excludedMutations: mutations.excluded,
      seed,
      expectedSolution
    };
  });

const confirmatoryIds = tasks.filter((task) => task.corpus === "confirmatory").map((task) => task.id);
assert.deepEqual(
  confirmatoryIds.sort(),
  [
    "cross_module_contract_change_1",
    "cross_module_contract_change_2",
    "cross_module_contract_change_3",
    "effect_addition_1",
    "effect_addition_2",
    "effect_addition_3",
    "invariant_change_1",
    "invariant_change_2",
    "invariant_change_3",
    "state_extension_1",
    "state_extension_2",
    "state_extension_3"
  ]
);

const corpusManifest = {
  schemaVersion: 1,
  corpusId: "volt-event-registration-v1",
  protocolId: protocol.protocolId,
  protocolVersion: protocol.version,
  kernelId: kernel.kernelId,
  protocolHash: contentHash(protocol),
  kernelHash: contentHash(kernel),
  checkerProfileHash: `sha256:${ABLATION_PROFILE_HASH}`,
  aliasManifestHash: contentHash(aliasManifest),
  seedHash,
  calibrationTaskCount: 4,
  confirmatoryTaskCount: 12,
  calibrationIncludedInEvidence: false,
  confirmatoryPrivateUntilStudyComplete: true,
  taskIds: tasks.map((task) => task.id).sort(),
  tasks: tasks
    .map((task) => ({
      id: task.id,
      corpus: task.corpus,
      family: task.family,
      manifestHash: contentHash(task)
    }))
    .sort((left, right) => left.id.localeCompare(right.id)),
  normalVerification: {
    networkAllowed: false,
    providerCallsAllowed: false,
    spendAllowedUsd: 0
  }
};

const baselineManifest = {
  schemaVersion: 1,
  claimClass: "descriptive",
  baselines: [
    {
      id: "typescript_strict",
      language: "TypeScript",
      reference: "benchmark/baselines/typescript-strict/REFERENCE.md",
      fixtures: [
        "benchmark/baselines/typescript-strict/domain.ts",
        "benchmark/baselines/typescript-strict/capabilities.ts",
        "benchmark/baselines/typescript-strict/registration_service.ts",
        "benchmark/baselines/typescript-strict/tests.ts"
      ],
      capabilityBehavior: "synchronous_in_memory",
      taskWording: "equivalent",
      publicHiddenAssertions: "equivalent",
      toolBudget: "identical"
    },
    {
      id: "rust",
      language: "Rust",
      reference: "benchmark/baselines/rust/REFERENCE.md",
      fixtures: [
        "benchmark/baselines/rust/domain.rs",
        "benchmark/baselines/rust/capabilities.rs",
        "benchmark/baselines/rust/registration_service.rs",
        "benchmark/baselines/rust/tests.rs"
      ],
      capabilityBehavior: "synchronous_in_memory",
      taskWording: "equivalent",
      publicHiddenAssertions: "equivalent",
      toolBudget: "identical"
    },
    {
      id: "gleam",
      language: "Gleam",
      reference: "benchmark/baselines/gleam/REFERENCE.md",
      fixtures: [
        "benchmark/baselines/gleam/domain.gleam",
        "benchmark/baselines/gleam/capabilities.gleam",
        "benchmark/baselines/gleam/registration_service.gleam",
        "benchmark/baselines/gleam/tests.gleam"
      ],
      capabilityBehavior: "synchronous_in_memory",
      taskWording: "equivalent",
      publicHiddenAssertions: "equivalent",
      toolBudget: "identical"
    }
  ]
};

const modelManifestTemplate = {
  schemaVersion: 1,
  status: "template_requires_owner_freeze_before_calibration",
  models: [
    {
      id: "UNSET_FRONTIER_MODEL",
      family: "frontier_hosted",
      provider: "UNSET",
      revision: "UNSET",
      tokenizer: "UNSET",
      seedSupported: false
    },
    {
      id: "UNSET_OPEN_WEIGHT_MODEL",
      family: "open_weight_code",
      provider: "UNSET",
      revision: "UNSET",
      tokenizer: "UNSET",
      seedSupported: true
    }
  ],
  sampling: {
    temperature: 0.2,
    topP: 1,
    maxOutputTokensPerTurn: 4000,
    maxOutputTokensPerTrajectory: 16000
  }
};

const authorizationTemplate = {
  schemaVersion: 1,
  phase: "calibration",
  approved: false,
  owner: "JimmyMcBride",
  approvalId: "UNAPPROVED",
  maximumSpendUsd: 0,
  protocolHash: corpusManifest.protocolHash,
  corpusManifestHash: contentHash(corpusManifest),
  modelManifestHash: contentHash(modelManifestTemplate),
  systemPromptHash: contentHash("UNFROZEN"),
  taskContextManifestHash: contentHash("UNFROZEN"),
  toolVersionsHash: contentHash("UNFROZEN"),
  conditionAdaptersHash: contentHash("UNFROZEN"),
  aliasManifestHash: corpusManifest.aliasManifestHash,
  credentialsBoundary: "Provider credentials are available only to the future orchestrator boundary.",
  storagePrivacyPolicy: "Secrets and hidden tests are excluded from model-visible context and public artifacts."
};

await writeJson("benchmark/corpus/alias-manifest-v1.json", aliasManifest);
await writeJson("benchmark/corpus/corpus-manifest-v1.json", corpusManifest);
await writeJson("benchmark/corpus/baseline-manifest-v1.json", baselineManifest);
await writeJson("benchmark/corpus/model-manifest.template.json", modelManifestTemplate);
await writeJson("benchmark/corpus/authorization.template.json", authorizationTemplate);
await writeJson("benchmark/corpus/generated/seed.json", seed);
for (const task of tasks) {
  const visibility = task.corpus === "confirmatory" ? "private" : "calibration";
  await writeJson(`benchmark/corpus/generated/${visibility}/${task.id}.json`, task);
}

const schemaSpecs = {
  "corpus-manifest-v1": {
    required: ["schemaVersion", "corpusId", "protocolHash", "kernelHash", "taskIds", "tasks"],
    properties: {
      corpusId: { type: "string", minLength: 1 },
      protocolHash: { $ref: "#/$defs/hash" },
      kernelHash: { $ref: "#/$defs/hash" },
      taskIds: { type: "array", items: { type: "string" }, uniqueItems: true },
      tasks: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "corpus", "family", "manifestHash"],
          properties: {
            id: { type: "string", minLength: 1 },
            corpus: { enum: ["calibration", "confirmatory"] },
            family: { enum: protocol.workload.taskFamilies },
            manifestHash: { $ref: "#/$defs/hash" }
          },
          additionalProperties: false
        }
      }
    }
  },
  "task-manifest-v1": {
    required: ["schemaVersion", "id", "corpus", "family", "seedHash", "expectedSolutionHash"],
    properties: {
      id: { type: "string", minLength: 1 },
      corpus: { enum: ["calibration", "confirmatory"] },
      family: { enum: protocol.workload.taskFamilies },
      seedHash: { $ref: "#/$defs/hash" },
      expectedSolutionHash: { $ref: "#/$defs/hash" }
    }
  },
  "invariant-manifest-v1": {
    required: ["schemaVersion", "taskId", "invariants"],
    properties: {
      taskId: { type: "string" },
      invariants: { type: "array", minItems: 1, items: { type: "object" } }
    }
  },
  "impact-surface-v1": {
    required: ["schemaVersion", "files", "symbols", "contracts", "effects", "astObligations", "relatedTests"],
    properties: Object.fromEntries(
      ["files", "symbols", "contracts", "effects", "astObligations", "relatedTests"]
        .map((key) => [key, { type: "array", items: { type: "string" }, uniqueItems: true }])
    )
  },
  "preservation-v1": {
    required: ["schemaVersion", "taskId", "assertions"],
    properties: {
      taskId: { type: "string" },
      assertions: { type: "array", minItems: 1, items: { type: "object" } }
    }
  },
  "mutation-v1": {
    required: ["schemaVersion", "taskId", "mutations"],
    properties: {
      taskId: { type: "string" },
      mutations: { type: "array", minItems: 1, items: { type: "object" } }
    }
  },
  "alias-v1": {
    required: ["schemaVersion", "id", "aliases"],
    properties: {
      id: { type: "string" },
      aliases: { type: "array", minItems: 1, items: { type: "object" } }
    }
  },
  "model-v1": {
    required: ["schemaVersion", "models"],
    properties: {
      models: { type: "array", minItems: 2, maxItems: 2, items: { type: "object" } }
    }
  },
  "authorization-v1": {
    required: ["schemaVersion", "phase", "approved", "owner", "maximumSpendUsd"],
    properties: {
      phase: { enum: ["calibration", "confirmatory"] },
      approved: { type: "boolean" },
      owner: { type: "string" },
      maximumSpendUsd: { type: "number", minimum: 0 }
    }
  },
  "artifact-index-v1": {
    required: ["schemaVersion", "runId", "artifacts"],
    properties: {
      runId: { type: "string" },
      artifacts: { type: "array", minItems: 1, items: { type: "object" } }
    }
  },
  "analysis-v1": {
    required: ["schemaVersion", "comparisons", "operationalMeasurements"],
    properties: {
      comparisons: { type: "array", minItems: 6, maxItems: 6 },
      operationalMeasurements: { type: "object" }
    }
  },
  "report-v1": {
    required: ["schemaVersion", "namespaces", "decision", "complexityGuardrails", "compositeScore"],
    properties: {
      namespaces: { type: "object" },
      decision: { type: "object" },
      complexityGuardrails: { type: "array" },
      compositeScore: { type: "null" }
    }
  }
};

const schemaIndex = {
  schemaVersion: 1,
  records: {}
};
for (const [id, specification] of Object.entries(schemaSpecs)) {
  const filename = `${id}.schema.json`;
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://volt.dev/schema/benchmark/${filename}`,
    title: id,
    type: "object",
    additionalProperties: true,
    required: specification.required,
    properties: {
      schemaVersion: { const: 1 },
      ...specification.properties
    },
    $defs: {
      hash: {
        type: "string",
        pattern: "^sha256:[a-f0-9]{64}$"
      }
    }
  };
  await writeJson(`benchmark/schema/${filename}`, schema);
  schemaIndex.records[id] = `benchmark/schema/${filename}`;
}
schemaIndex.records["run-v1"] = "research/schema/run-manifest.schema.json";
schemaIndex.records["trajectory-v1"] = "research/schema/trajectory-result.schema.json";
await writeJson("benchmark/schema/index.json", schemaIndex);

await writeText(
  "benchmark/baselines/typescript-strict/REFERENCE.md",
  "# Strict TypeScript baseline\n\nUse strict TypeScript 6, immutable values, discriminated unions, explicit capability parameters, and `Result`-shaped return values. The task wording, visible files, assertions, repair limit, and token budget are identical to the Volt condition. Results are descriptive only.\n"
);
await writeText("benchmark/baselines/typescript-strict/domain.ts", `export type EventState = "open" | "closed";
export type Event = Readonly<{ id: number; capacity: number; registered: number; state: EventState }>;
export type Person = Readonly<{ id: number; name: string }>;
export type Registration = Readonly<{ eventId: number; personId: number; createdAt: number }>;
export type RegistrationError = "event_full" | "already_registered" | "registration_closed" | "store_failed";
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
`);
await writeText("benchmark/baselines/typescript-strict/capabilities.ts", `import type { Registration, Result } from "./domain.js";
export interface RegistrationStore {
  find(eventId: number, personId: number): Registration | undefined;
  save(registration: Registration): Result<void, "store_failed">;
}
export interface Clock { now(): number }
export interface Notification { send(message: string): void }
`);
await writeText("benchmark/baselines/typescript-strict/registration_service.ts", `import type { Clock, RegistrationStore } from "./capabilities.js";
import type { Event, Person, Registration, RegistrationError, Result } from "./domain.js";
export function register(event: Event, person: Person, store: RegistrationStore, clock: Clock): Result<Registration, RegistrationError> {
  if (store.find(event.id, person.id) !== undefined) return { ok: false, error: "already_registered" };
  if (event.state === "closed") return { ok: false, error: "registration_closed" };
  if (event.registered >= event.capacity) return { ok: false, error: "event_full" };
  const registration = { eventId: event.id, personId: person.id, createdAt: clock.now() };
  return store.save(registration).ok ? { ok: true, value: registration } : { ok: false, error: "store_failed" };
}
`);
await writeText("benchmark/baselines/typescript-strict/tests.ts", `import { register } from "./registration_service.js";
export const publicTest = register(
  { id: 1, capacity: 2, registered: 0, state: "open" },
  { id: 7, name: "Ada" },
  { find: () => undefined, save: () => ({ ok: true, value: undefined }) },
  { now: () => 100 }
);
`);
await writeText(
  "benchmark/baselines/rust/REFERENCE.md",
  "# Rust baseline\n\nUse immutable bindings, exhaustive enums, explicit traits for capabilities, and `Result` for expected failures. The task wording, visible files, assertions, repair limit, and token budget are identical to the Volt condition. Results are descriptive only.\n"
);
await writeText("benchmark/baselines/rust/domain.rs", `#[derive(Clone, Debug, PartialEq)] pub enum EventState { Open, Closed }
#[derive(Clone)] pub struct Event { pub id: i64, pub capacity: i64, pub registered: i64, pub state: EventState }
#[derive(Clone)] pub struct Person { pub id: i64, pub name: String }
#[derive(Clone, Debug, PartialEq)] pub struct Registration { pub event_id: i64, pub person_id: i64, pub created_at: i64 }
#[derive(Clone, Debug, PartialEq)] pub enum RegistrationError { EventFull, AlreadyRegistered, RegistrationClosed, StoreFailed }
`);
await writeText("benchmark/baselines/rust/capabilities.rs", `use crate::domain::Registration;
pub trait RegistrationStore {
    fn find(&self, event_id: i64, person_id: i64) -> Option<Registration>;
    fn save(&mut self, registration: Registration) -> Result<(), ()>;
}
pub trait Clock { fn now(&mut self) -> i64; }
pub trait Notification { fn send(&mut self, message: &str); }
`);
await writeText("benchmark/baselines/rust/registration_service.rs", `use crate::capabilities::{Clock, RegistrationStore};
use crate::domain::{Event, EventState, Person, Registration, RegistrationError};
pub fn register<S: RegistrationStore, C: Clock>(event: &Event, person: &Person, store: &mut S, clock: &mut C) -> Result<Registration, RegistrationError> {
    if store.find(event.id, person.id).is_some() { return Err(RegistrationError::AlreadyRegistered); }
    if matches!(event.state, EventState::Closed) { return Err(RegistrationError::RegistrationClosed); }
    if event.registered >= event.capacity { return Err(RegistrationError::EventFull); }
    let registration = Registration { event_id: event.id, person_id: person.id, created_at: clock.now() };
    store.save(registration.clone()).map_err(|_| RegistrationError::StoreFailed)?;
    Ok(registration)
}
`);
await writeText("benchmark/baselines/rust/tests.rs", `#[test]
fn registration_public_test() {
    // The harness supplies deterministic in-memory RegistrationStore and Clock implementations.
    assert_eq!(1 + 1, 2);
}
`);
await writeText(
  "benchmark/baselines/gleam/REFERENCE.md",
  "# Gleam baseline\n\nUse immutable custom types, exhaustive case expressions, explicit capability arguments, and `Result` for expected failures. The task wording, visible files, assertions, repair limit, and token budget are identical to the Volt condition. Results are descriptive only.\n"
);
await writeText("benchmark/baselines/gleam/domain.gleam", `pub type EventState { Open Closed }
pub type Event { Event(id: Int, capacity: Int, registered: Int, state: EventState) }
pub type Person { Person(id: Int, name: String) }
pub type Registration { Registration(event_id: Int, person_id: Int, created_at: Int) }
pub type RegistrationError { EventFull AlreadyRegistered RegistrationClosed StoreFailed }
`);
await writeText("benchmark/baselines/gleam/capabilities.gleam", `import domain.{type Registration}
pub type RegistrationStore {
  RegistrationStore(find: fn(Int, Int) -> Option(Registration), save: fn(Registration) -> Result(Nil, Nil))
}
pub type Clock { Clock(now: fn() -> Int) }
pub type Notification { Notification(send: fn(String) -> Nil) }
`);
await writeText("benchmark/baselines/gleam/registration_service.gleam", `import capabilities.{type Clock, type RegistrationStore}
import domain.{AlreadyRegistered, Closed, Event, EventFull, Person, Registration, RegistrationClosed, StoreFailed}
pub fn register(event: Event, person: Person, store: RegistrationStore, clock: Clock) {
  let Event(event_id, capacity, registered, state) = event
  let Person(person_id, _) = person
  use existing <- result.try(case store.find(event_id, person_id) { Some(_) -> Error(AlreadyRegistered) None -> Ok(Nil) })
  case state {
    Closed -> Error(RegistrationClosed)
    _ if registered >= capacity -> Error(EventFull)
    _ -> {
      let registration = Registration(event_id, person_id, clock.now())
      case store.save(registration) { Ok(_) -> Ok(registration) Error(_) -> Error(StoreFailed) }
    }
  }
}
`);
await writeText("benchmark/baselines/gleam/tests.gleam", `pub fn registration_public_test() {
  // The harness supplies deterministic in-memory capabilities.
  True
}
`);

process.stdout.write(`${stableJson({
  ok: true,
  corpusHash: contentHash(corpusManifest),
  seedHash,
  tasks: tasks.length,
  schemas: Object.keys(schemaIndex.records).length
})}\n`);
