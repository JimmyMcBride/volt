import { analyzePublicChanges, compileSources, run } from "../../dist/toolchain/src/index.js";
import { contentHash } from "./stable.mjs";
import { validateTaskManifest } from "./validation.mjs";

export function sourceArray(files) {
  return Object.entries(files)
    .filter(([path]) => path.endsWith(".volt"))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, text]) => ({ path, text }));
}

function variant(type, constructor, payload) {
  return {
    kind: "variant",
    type,
    constructor,
    ...(payload === undefined ? {} : { payload })
  };
}

function record(type, fields) {
  return { kind: "record", type, fields };
}

function registrationScenario(compilation, {
  state = "Open",
  capacity = 2n,
  registered = 0n,
  existing = false,
  storeFails = false
} = {}) {
  const event = record("domain::Event", {
    id: 1n,
    capacity,
    registered,
    state: variant("domain::EventState", state)
  });
  const person = record("domain::Person", {
    id: 7n,
    name: "Ada",
    ...(compilation.ast
      .find((ast) => ast.module === "domain")
      ?.declarations.find((declaration) => declaration.kind === "record" && declaration.name === "Person")
      ?.fields.some((field) => field.name === "age") ? { age: 36n } : {})
  });
  const registration = record("domain::Registration", {
    eventId: 1n,
    personId: 7n,
    ...(compilation.ast
      .find((ast) => ast.module === "domain")
      ?.declarations.find((declaration) => declaration.kind === "record" && declaration.name === "Registration")
      ?.fields.some((field) => field.name === "sourceCode") ? { sourceCode: 1n } : {}),
    createdAt: 100n
  });
  const storeError = variant("domain::StoreError", "Unavailable");
  const adapters = [
    {
      effectId: "capabilities::effect::Clock",
      operations: { now: () => 100n }
    },
    {
      effectId: "capabilities::effect::RegistrationStore",
      operations: {
        find: () => existing
          ? variant("Option<domain::Registration>", "Some", registration)
          : variant("Option<domain::Registration>", "None"),
        save: () => storeFails
          ? variant("Result<Unit,domain::StoreError>", "Error", storeError)
          : variant("Result<Unit,domain::StoreError>", "Ok", null)
      }
    }
  ];
  const register = compilation.ast
    .find((ast) => ast.module === "registrationService")
    ?.declarations.find((declaration) => declaration.kind === "function" && declaration.name === "register");
  const args = register?.kind === "function" && register.params.length === 3
    ? [event, person, 99n]
    : [event, person];
  return run(compilation, "registrationService.register", adapters, args);
}

function errorConstructor(result) {
  if (result.value?.constructor !== "Error") return null;
  return result.value.payload?.constructor ?? null;
}

function runtimeRegistrationScenarios(files) {
  const compilation = compileSources(sourceArray(files), "full");
  if (compilation.diagnostics.length > 0) {
    return {
      passed: false,
      detail: compilation.diagnostics.map((diagnostic) => diagnostic.code)
    };
  }
  const successful = registrationScenario(compilation);
  const full = registrationScenario(compilation, { capacity: 1n, registered: 1n });
  const closed = registrationScenario(compilation, { state: "Closed" });
  const duplicate = registrationScenario(compilation, { existing: true });
  const storeFailure = registrationScenario(compilation, { storeFails: true });
  const observations = {
    success: successful.value?.constructor,
    capacity: errorConstructor(full),
    closed: errorConstructor(closed),
    idempotency: errorConstructor(duplicate),
    storeFailure: errorConstructor(storeFailure),
    internalFailures: [successful, full, closed, duplicate, storeFailure]
      .filter((result) => result.internalFailure).length
  };
  return {
    passed:
      observations.success === "Ok" &&
      observations.capacity === "EventFull" &&
      observations.closed === "RegistrationClosed" &&
      observations.idempotency === "AlreadyRegistered" &&
      observations.storeFailure === "StoreFailed" &&
      observations.internalFailures === 0,
    detail: observations
  };
}

function assertInvariant(task, invariant, files) {
  if (invariant.assertion.type === "compiles_full") {
    const compilation = compileSources(sourceArray(files), "full");
    return {
      passed: compilation.diagnostics.length === 0,
      detail: compilation.diagnostics.map((diagnostic) => diagnostic.code)
    };
  }
  if (invariant.assertion.type === "source_contains") {
    const source = files[invariant.assertion.file] ?? "";
    return {
      passed: source.includes(invariant.assertion.text),
      detail: invariant.assertion.text
    };
  }
  if (invariant.assertion.type === "source_excludes") {
    const source = files[invariant.assertion.file] ?? "";
    return {
      passed: !source.includes(invariant.assertion.text),
      detail: invariant.assertion.text
    };
  }
  if (invariant.assertion.type === "public_change_category") {
    const changes = analyzePublicChanges(
      sourceArray(task.seed.files),
      sourceArray(files)
    );
    return {
      passed: changes.some((change) => change.category === invariant.assertion.category),
      detail: changes.map((change) => change.category)
    };
  }
  if (invariant.assertion.type === "preserves_source") {
    const source = files[invariant.assertion.file] ?? "";
    return {
      passed: source.includes(invariant.assertion.text),
      detail: invariant.assertion.text
    };
  }
  if (invariant.assertion.type === "runtime_registration_scenarios") {
    return runtimeRegistrationScenarios(files);
  }
  throw new TypeError(`unknown invariant assertion: ${invariant.assertion.type}`);
}

export function runHiddenTests(task, files) {
  validateTaskManifest(task);
  const results = task.invariants.map((invariant) => ({
    id: invariant.id,
    hidden: invariant.hidden,
    ...assertInvariant(task, invariant, files)
  }));
  return {
    passed: results.every((result) => result.passed),
    results,
    privateOutput: results
      .filter((result) => !result.passed)
      .map((result) => ({ id: result.id, detail: result.detail }))
  };
}

export function applyMutation(task, mutation) {
  return {
    ...task.expectedSolution.files,
    ...mutation.sourceOverrides
  };
}

export function verifyMutationCatalog(task) {
  const results = task.mutations.map((mutation) => {
    const hidden = runHiddenTests(task, applyMutation(task, mutation));
    return {
      mutationId: mutation.id,
      killed: !hidden.passed,
      declaredKilledBy: mutation.killedBy,
      killedBy: hidden.results.filter((result) => !result.passed).map((result) => result.id)
    };
  });
  return {
    passed: results.every(
      (result) => result.killed && result.killedBy.includes(result.declaredKilledBy)
    ),
    results
  };
}

export function verifyTaskContentHashes(task) {
  return {
    seed: contentHash(task.seed) === task.seedHash,
    expectedSolution: contentHash(task.expectedSolution) === task.expectedSolutionHash
  };
}

export function publicTaskContext(task) {
  validateTaskManifest(task);
  return {
    schemaVersion: 1,
    id: task.id,
    family: task.family,
    corpus: task.corpus,
    wording: task.publicTask.wording,
    files: Object.fromEntries(
      task.publicTask.visibleFiles.map((path) => [path, task.seed.files[path]])
    ),
    publicTests: task.publicTask.publicTests,
    allowedTools: task.publicTask.allowedTools,
    nonGoals: task.publicTask.nonGoals
  };
}
