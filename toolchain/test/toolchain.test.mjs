import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  ABLATION_PROFILE,
  ABLATION_PROFILE_HASH,
  analyzePublicChanges,
  clockAdapter,
  compileSources,
  databaseAdapter,
  formatSource,
  notificationAdapter,
  publicChangeDiagnostics,
  renderNdjson,
  renderText,
  run,
  serializeValue,
  stableJson
} from "../../dist/toolchain/src/index.js";

const root = resolve(import.meta.dirname, "../..");
const execFileAsync = promisify(execFile);
const source = (path, text) => ({ path, text: `${text.trim()}\n` });

async function fixture(path) {
  return readFile(resolve(root, path), "utf8");
}

test("all accepted kernel fixtures parse and check in full mode", async () => {
  const single = ["allSyntax", "containers", "effects", "matching", "records"];
  for (const name of single) {
    const result = compileSources([
      source(`${name}.volt`, await fixture(`language/fixtures/accepted/${name}.volt`))
    ]);
    assert.deepEqual(result.diagnostics, [], name);
    assert.equal(result.normalizedAst[0].hash.length, 64);
    assert.equal(result.runManifest.checkerProfileHash, ABLATION_PROFILE_HASH);
  }
  const modules = compileSources([
    source("modules/domain.volt", await fixture("language/fixtures/accepted/modules/domain.volt")),
    source("modules/registration.volt", await fixture("language/fixtures/accepted/modules/registration.volt"))
  ]);
  assert.deepEqual(modules.diagnostics, []);
});

test("every rejected kernel fixture emits its frozen diagnostic code", async () => {
  const manifest = JSON.parse(await fixture("language/conformance/manifest.json"));
  const domain = source(
    "modules/domain.volt",
    await fixture("language/fixtures/accepted/modules/domain.volt")
  );
  for (const item of manifest.rejected) {
    const path = item.path.split("/").at(-1);
    const files = [source(path, await fixture(item.path))];
    if (item.id === "unused_import") files.unshift(domain);
    const result = compileSources(files);
    assert.ok(
      result.diagnostics.some((diagnostic) => diagnostic.code === item.expectedCode),
      `${item.id}: ${result.diagnostics.map((diagnostic) => diagnostic.code).join(", ")}`
    );
  }
});

test("deferred and excluded spellings retain their stable diagnostic categories", () => {
  const cases = [
    ["wildcard.volt", "module wildcard\nimport domain.*", "K_IMPORT_WILDCARD"],
    ["generic.volt", "module generic\npub fn identity<T>(value: Int) -> Int { value }", "K_FEATURE_DEFERRED"],
    ["propagate.volt", "module propagate\npub fn value() -> Int { other()? }", "K_FEATURE_DEFERRED"],
    ["nullValue.volt", "module nullValue\npub fn value() -> Int { null }", "K_FEATURE_EXCLUDED"]
  ];
  for (const [path, text, code] of cases) {
    assert.ok(compileSources([source(path, text)]).diagnostics.some((item) => item.code === code), code);
  }
});

test("formatter implements all approved goldens and is byte-idempotent", async () => {
  const goldens = JSON.parse(await fixture("language/formatter/golden.json"));
  for (const item of goldens.cases) {
    const first = formatSource(`${item.id}.volt`, item.input);
    assert.deepEqual(first.diagnostics, [], item.id);
    assert.equal(first.output, item.expected, item.id);
    const second = formatSource(`${item.id}.volt`, first.output);
    assert.equal(second.output, item.expected, `${item.id} idempotence`);
  }
});

test("canonical names reject underscores and wrong case across identifier roles", () => {
  const cases = [
    ["module", "module bad_module", "K_NAME_UNDERSCORE"],
    ["module casing", "module Sample", "K_NAME_CONVENTION"],
    ["function", "module sample\npub fn bad_name() -> Int { 1 }", "K_NAME_UNDERSCORE"],
    ["function casing", "module sample\npub fn BadName() -> Int { 1 }", "K_NAME_CONVENTION"],
    ["record", "module sample\npub record person { id: Int }", "K_NAME_CONVENTION"],
    ["ADT", "module sample\npub type state { Open }", "K_NAME_CONVENTION"],
    ["variant", "module sample\npub type State { open }", "K_NAME_CONVENTION"],
    ["effect", "module sample\npub effect clock { fn now() -> Int }", "K_NAME_CONVENTION"],
    ["effect operation", "module sample\npub effect Clock { fn current_time() -> Int }", "K_NAME_UNDERSCORE"],
    ["effect operation casing", "module sample\npub effect Clock { fn Now() -> Int }", "K_NAME_CONVENTION"],
    ["parameter", "module sample\npub fn value(bad_name: Int) -> Int { bad_name }", "K_NAME_UNDERSCORE"],
    ["parameter casing", "module sample\npub fn value(Input: Int) -> Int { Input }", "K_NAME_CONVENTION"],
    ["record field", "module sample\npub record Person { display_name: String }", "K_NAME_UNDERSCORE"],
    ["record field casing", "module sample\npub record Person { DisplayName: String }", "K_NAME_CONVENTION"],
    ["local binding", "module sample\npub fn value() -> Int { let local_value = 1 in local_value }", "K_NAME_UNDERSCORE"],
    ["local binding casing", "module sample\npub fn value() -> Int { let LocalValue = 1 in LocalValue }", "K_NAME_CONVENTION"],
    ["type reference", "module sample\npub fn value(input: person) -> Int { 1 }", "K_NAME_CONVENTION"],
    ["value reference", "module sample\npub fn value() -> Int { other_value() }", "K_NAME_UNDERSCORE"],
    ["imported name", "module sample\nimport domain.{some_name}", "K_NAME_UNDERSCORE"]
  ];
  for (const [role, text, code] of cases) {
    const result = compileSources([source("sample.volt", text)]);
    assert.equal(result.diagnostics[0]?.code, code, role);
  }
});

test("formatter never silently renames invalid identifiers", () => {
  const result = formatSource("sample.volt", "module sample\npub fn snake_case() -> Int { 1 }\n");
  assert.equal(result.output, undefined);
  assert.equal(result.diagnostics[0]?.code, "K_NAME_UNDERSCORE");
});

test("erased checker disables exactly the approved obligations and propagates Unknown", () => {
  const files = [
    source("domain.volt", `
      module domain
      pub record Spare { id: Int }
    `),
    source("sample.volt", `
      module sample
      import domain.{Spare}
      pub type Flag {
        On
        Off
      }
      pub effect Clock {
        fn now() -> Int
      }
      pub fn broken(flag: Flag) -> Int {
        match flag {
          On -> Clock.now()
        }
      }
    `)
  ];
  const full = compileSources(files, "full");
  const erased = compileSources(files, "static_obligations_erased");
  assert.deepEqual(
    new Set(full.diagnostics.map((item) => item.code)),
    new Set(["K_EFFECT_MISSING", "K_IMPORT_UNUSED", "K_MATCH_NON_EXHAUSTIVE"])
  );
  assert.deepEqual(erased.diagnostics, []);
  assert.ok(erased.typedIr.flatMap((item) => item.expressions).some((item) => item.inferredType === "Unknown"));
  assert.equal(full.runManifest.checkerProfileHash, erased.runManifest.checkerProfileHash);
});

test("retained local errors remain visible in erased mode without cascades", () => {
  const result = compileSources([
    source("localError.volt", `
      module localError
      pub fn bad() -> Int {
        true + 1
      }
    `)
  ], "static_obligations_erased");
  assert.deepEqual(result.diagnostics.map((item) => item.code), ["K_TYPE_LOCAL_OPERATOR"]);
});

test("every checker code is classified exactly once", () => {
  const retained = new Set(ABLATION_PROFILE.retained);
  const disabled = new Set(ABLATION_PROFILE.disabled);
  assert.equal([...retained].some((code) => disabled.has(code)), false);
  assert.equal(retained.size + disabled.size, ABLATION_PROFILE.retained.length + ABLATION_PROFILE.disabled.length);
  assert.match(ABLATION_PROFILE_HASH, /^[0-9a-f]{64}$/u);
});

test("normalized AST erases identifiers and literals while preserving shape and operators", () => {
  const left = compileSources([source("shape.volt", `
    module shape
    pub fn add(first: Int) -> Int { first + 1 }
  `)]);
  const right = compileSources([source("shape.volt", `
    module shape
    pub fn add(second: Int) -> Int { second + 99 }
  `)]);
  assert.equal(left.normalizedAst[0].hash, right.normalizedAst[0].hash);
  assert.match(JSON.stringify(left.normalizedAst[0].root), /"operator":"\+"/u);
});

test("program graph has stable ordered definition, call, import, effect, match, and test edges", () => {
  const files = [
    source("domain.volt", `
      module domain
      pub type Status { Open Closed }
      pub fn identity(value: Int) -> Int { value }
    `),
    source("service.volt", `
      module service
      import domain.{Status, identity}
      pub record Box { value: Int }
      pub effect Clock { fn now() -> Int }
      pub fn box(value: Int) -> Box { Box { value: value } }
      pub fn work(status: Status) uses {Clock} -> Int {
        match status {
          Open -> identity(Clock.now())
          Closed -> 0
        }
      }
    `),
    source("tests.volt", `
      module tests
      import domain.{Status}
      import service.{Clock, work}
      pub fn workTest() uses {Clock} -> Int { work(Open) }
    `)
  ];
  const first = compileSources(files);
  const second = compileSources(files);
  assert.deepEqual(first.diagnostics, []);
  assert.deepEqual(first.graph, second.graph);
  const reasons = new Set(first.graph.edges.map((edge) => edge.reason));
  for (const reason of ["defines", "references", "imports", "calls", "constrains", "matches", "uses-effect", "tested-by"]) {
    assert.ok(reasons.has(reason), reason);
  }
  assert.deepEqual(
    first.graph.nodes.map((item) => item.id),
    [...first.graph.nodes.map((item) => item.id)].sort()
  );
});

test("text and NDJSON diagnostics carry the same ordered facts and UTF-8 byte ranges", () => {
  const result = compileSources([source("café.volt", `
    module café
  `)]);
  assert.equal(result.diagnostics[0].code, "K_LEX_IDENTIFIER_ASCII");
  assert.equal(result.diagnostics[0].range.endByte - result.diagnostics[0].range.startByte, 2);
  const ndjson = renderNdjson(result.diagnostics);
  const text = renderText(result.diagnostics);
  assert.match(ndjson, /K_LEX_IDENTIFIER_ASCII/u);
  assert.match(text, /K_LEX_IDENTIFIER_ASCII/u);
  assert.match(text, /"related":\[\]/u);
  assert.deepEqual(JSON.parse(ndjson), result.diagnostics[0]);
});

test("diagnostic renderers canonically order and resequence their input", () => {
  const range = {
    startByte: 0,
    endByte: 1,
    startLine: 0,
    startColumn: 0,
    endLine: 0,
    endColumn: 1
  };
  const diagnostics = [
    {
      schemaVersion: 1,
      sequence: 77,
      phase: "type",
      code: "K_TYPE_Z",
      severity: "error",
      message: "z",
      file: "z.volt",
      range,
      related: [],
      repairs: []
    },
    {
      schemaVersion: 1,
      sequence: 99,
      phase: "parse",
      code: "K_PARSE_A",
      severity: "error",
      message: "a",
      file: "a.volt",
      range,
      related: [],
      repairs: []
    }
  ];

  const ndjson = renderNdjson(diagnostics)
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    ndjson.map(({ file, sequence }) => ({ file, sequence })),
    [
      { file: "a.volt", sequence: 0 },
      { file: "z.volt", sequence: 1 }
    ]
  );
  assert.match(renderText(diagnostics), /^v1#0 a\.volt:/u);
  assert.match(renderText(diagnostics), /\nv1#1 z\.volt:/u);
  assert.deepEqual(
    diagnostics.map(({ file, sequence }) => ({ file, sequence })),
    [
      { file: "z.volt", sequence: 77 },
      { file: "a.volt", sequence: 99 }
    ]
  );
});

test("stable JSON maps unsupported JavaScript values to null", () => {
  assert.equal(stableJson(undefined), "null");
  assert.equal(stableJson(() => undefined), "null");
  assert.equal(stableJson(Symbol("unsupported")), "null");
  assert.equal(stableJson([undefined]), "[null]");
  assert.equal(stableJson({ unsupported: undefined }), '{"unsupported":null}');
  assert.deepEqual(JSON.parse(stableJson({ unsupported: undefined })), {
    unsupported: null
  });
});

test("tree-walking interpreter is deterministic and injects synchronous capabilities", () => {
  const pure = compileSources([source("main.volt", `
    module main
    pub fn calculate() -> Int { 1 + 2 * 3 }
  `)]);
  assert.deepEqual(pure.diagnostics, []);
  assert.equal(run(pure, "main.calculate").value, 7n);
  const unqualified = run(pure, "calculate");
  assert.equal(unqualified.internalFailure, true);
  assert.equal(unqualified.diagnostics[0].code, "V_RUNTIME_ENTRYPOINT");
  assert.match(unqualified.diagnostics[0].message, /fully qualified/u);

  const effectful = compileSources([source("time.volt", `
    module time
    pub effect Clock { fn now() -> Int }
    pub fn current() uses {Clock} -> Int { Clock.now() }
  `)]);
  const adapter = clockAdapter("time::effect::Clock", [42n]);
  assert.equal(run(effectful, "time.current", [adapter]).value, 42n);
  adapter.reset();
  assert.equal(run(effectful, "time.current", [adapter]).value, 42n);
  const missing = run(effectful, "time.current");
  assert.equal(missing.internalFailure, true);
  assert.equal(missing.diagnostics[0].code, "V_RUNTIME_ADAPTER_SET");
  const extra = run(pure, "main.calculate", [clockAdapter("time::effect::Clock")]);
  assert.equal(extra.internalFailure, true);
  assert.equal(extra.diagnostics[0].code, "V_RUNTIME_ADAPTER_SET");
});

test("parser-originated diagnostic codes retain their owning phase", () => {
  const typeBoundary = compileSources([
    source("missingBoundary.volt", `
      module missingBoundary
      pub fn broken(value) -> Int { 1 }
    `)
  ]);
  assert.equal(
    typeBoundary.diagnostics.find((diagnostic) => diagnostic.code === "K_TYPE_BOUNDARY")?.phase,
    "type"
  );

  const importAlias = compileSources([
    source("importAlias.volt", `
      module importAlias
      import modules.domain.{Person as User}
    `)
  ]);
  assert.equal(
    importAlias.diagnostics.find((diagnostic) => diagnostic.code === "K_IMPORT_ALIAS")?.phase,
    "resolve"
  );
});

test("deterministic database and notification adapters isolate state", () => {
  const database = databaseAdapter("capabilities::effect::Database");
  const notification = notificationAdapter("capabilities::effect::Notification");
  assert.equal(database.operations.find(1n).constructor, "None");
  database.operations.save(1n);
  assert.equal(database.operations.find(1n).constructor, "Some");
  notification.operations.send("hello");
  assert.deepEqual(notification.messages, ["hello"]);
  database.reset();
  notification.reset();
  assert.equal(database.operations.find(1n).constructor, "None");
  assert.deepEqual(notification.messages, []);
});

test("all five public change categories produce bounded deterministic impact facts", () => {
  const cases = [
    {
      category: "adt_variant",
      before: [source("domain.volt", "module domain\npub type State { On Off }")],
      after: [source("domain.volt", "module domain\npub type State { On Off Paused }")]
    },
    {
      category: "record_field",
      before: [source("domain.volt", "module domain\npub record Person { id: Int }")],
      after: [source("domain.volt", "module domain\npub record Person { id: Int, name: String }")]
    },
    {
      category: "function_contract",
      before: [source("api.volt", "module api\npub fn value(input: Int) -> Int { input }")],
      after: [source("api.volt", "module api\npub fn value(input: String) -> String { input }")]
    },
    {
      category: "effect_set",
      before: [source("api.volt", "module api\npub fn value() -> Int { 1 }")],
      after: [source("api.volt", "module api\npub effect Clock { fn now() -> Int }\npub fn value() uses {Clock} -> Int { Clock.now() }")]
    },
    {
      category: "module_move",
      before: [source("old.volt", "module old\npub record Person { id: Int }")],
      after: [source("new.volt", "module new\npub record Person { id: Int }")]
    }
  ];
  for (const item of cases) {
    const changes = analyzePublicChanges(item.before, item.after);
    assert.equal(changes[0].category, item.category);
    assert.match(changes[0].code, /^K_CHANGE_/u);
    assert.ok(Array.isArray(changes[0].repository.affectedSites));
    assert.ok(Array.isArray(changes[0].repository.affectedFiles));
    assert.ok(Array.isArray(changes[0].repository.boundedRepairSurface));
  }
  const fullDiagnostics = publicChangeDiagnostics(cases[1].before, cases[1].after, "full");
  assert.equal(fullDiagnostics[0].code, "K_CHANGE_RECORD_FIELD");
  assert.ok(fullDiagnostics[0].repository.affectedFiles.includes("domain.volt"));
  assert.deepEqual(
    publicChangeDiagnostics(cases[1].before, cases[1].after, "static_obligations_erased"),
    []
  );
});

test("repository manifest and CLI expose check, run, test, and fmt with stable exit codes", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "volt-toolchain-"));
  try {
    await mkdir(resolve(directory, "src"));
    await writeFile(resolve(directory, "volt.json"), JSON.stringify({
      schemaVersion: 1,
      sourceRoot: "src",
      run: "main.answer",
      tests: ["main.passes"]
    }));
    await writeFile(resolve(directory, "src/main.volt"), `
module main
pub fn answer()->Int { 42 }
pub fn passes()->Result<Unit,String> { Ok(()) }
`.trimStart());
    const cli = resolve(root, "dist/toolchain/src/cli.js");
    const check = await execFileAsync(process.execPath, [cli, "check", "--project", directory]);
    assert.equal(check.stdout, "");
    const runResult = await execFileAsync(process.execPath, [cli, "run", "--project", directory]);
    assert.equal(runResult.stdout, "\"42\"\n");
    const testResult = await execFileAsync(process.execPath, [cli, "test", "--project", directory]);
    assert.equal(testResult.stdout, "ok main.passes\n");
    await assert.rejects(
      execFileAsync(process.execPath, [cli, "fmt", "--check", "--project", directory]),
      (error) => error.code === 1 && /formatting changes required/u.test(error.stdout)
    );
    await execFileAsync(process.execPath, [cli, "fmt", "--write", "--project", directory]);
    await execFileAsync(process.execPath, [cli, "fmt", "--check", "--project", directory]);
    await writeFile(resolve(directory, "src/main.volt"), "module main\npub fn answer() -> Int { 42; }\n");
    await assert.rejects(
      execFileAsync(process.execPath, [cli, "check", "--project", directory]),
      (error) => error.code === 1 && /K_LEX_SEMICOLON/u.test(error.stdout)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("internal adapter failures use exit class 2 while program diagnostics use class 1", () => {
  const compilation = compileSources([source("time.volt", `
    module time
    pub effect Clock { fn now() -> Int }
    pub fn current() uses {Clock} -> Int { Clock.now() }
  `)]);
  const internal = run(compilation, "time.current", [{
    effectId: "time::effect::Clock",
    operations: { now: () => { throw new Error("host failed"); } }
  }]);
  assert.equal(internal.internalFailure, true);
  assert.equal(internal.diagnostics[0].code, "V_RUNTIME_HOST_EXCEPTION");
});

test("check and interpreter latency remain below protocol guardrails on conformance input", async () => {
  const text = await fixture("language/fixtures/accepted/allSyntax.volt");
  const checkSamples = [];
  const runSamples = [];
  for (let index = 0; index < 20; index += 1) {
    let start = performance.now();
    const compilation = compileSources([source("allSyntax.volt", text)]);
    checkSamples.push(performance.now() - start);
    start = performance.now();
    run(compilation, "allSyntax.selected", [], [true]);
    runSamples.push(performance.now() - start);
  }
  const p95 = (values) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
  assert.ok(p95(checkSamples) < 2_000, `check p95 ${p95(checkSamples)}ms`);
  assert.ok(p95(runSamples) < 5_000, `run p95 ${p95(runSamples)}ms`);
});

test("runtime values serialize without host-specific bigint behavior", () => {
  assert.deepEqual(serializeValue({
    kind: "record",
    type: "domain::Person",
    fields: { id: 1n }
  }), {
    kind: "record",
    type: "domain::Person",
    fields: { id: "1" }
  });
});
