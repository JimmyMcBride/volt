import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { assertAuthorized, loadAuthorization, refuseProviderBoundary } from "../lib/authorization.mjs";
import { ArtifactStore } from "../lib/artifacts.mjs";
import { FakeModel, ReplayModel, runTrajectory } from "../lib/harness.mjs";
import { contentHash, stableJson } from "../lib/stable.mjs";

const root = resolve(import.meta.dirname, "../..");
const mode = process.argv[2];
const supported = new Set(["offline", "calibration", "confirmatory"]);
if (!supported.has(mode)) {
  process.stderr.write("usage: node benchmark/scripts/run.mjs <offline|calibration|confirmatory> [--authorization path] [--estimated-spend usd]\n");
  process.exitCode = 2;
} else {
  const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
  const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
  };
  const [corpus, aliases, modelTemplate] = await Promise.all([
    readJson("benchmark/corpus/corpus-manifest-v1.json"),
    readJson("benchmark/corpus/alias-manifest-v1.json"),
    readJson("benchmark/corpus/model-manifest.template.json")
  ]);

  if (mode !== "offline") {
    const authorization = await loadAuthorization(argument("--authorization"));
    assertAuthorized({
      manifest: authorization,
      phase: mode,
      expectedHashes: {
        protocolHash: corpus.protocolHash,
        corpusManifestHash: contentHash(corpus),
        modelManifestHash: contentHash(modelTemplate),
        aliasManifestHash: corpus.aliasManifestHash
      },
      estimatedSpendUsd: Number(argument("--estimated-spend") ?? Number.POSITIVE_INFINITY)
    });
    refuseProviderBoundary(mode);
  } else {
    const taskNames = await readdir(resolve(root, "benchmark/corpus/generated/calibration"));
    const tasks = await Promise.all(
      taskNames.sort().map((name) => readJson(`benchmark/corpus/generated/calibration/${name}`))
    );
    const conditions = ["volt_full", "static_obligations_erased", "alias_permissive", "diagnostics_plain"];
    const records = [];
    const replayRecords = new Map();
    let tick = 0;
    const now = () => tick++;

    for (const [index, task] of tasks.entries()) {
      const condition = conditions[index];
      const response = {
        files: task.expectedSolution.files,
        generatedTokens: 100,
        toolCalls: ["inspect", "edit", "submit"]
      };
      const model = new FakeModel({ id: "offline-fake", responses: [response] });
      const store = new ArtifactStore();
      const record = await runTrajectory({
        task,
        condition,
        model,
        aliasManifest: aliases,
        now,
        artifactStore: store
      });
      await store.write(
        resolve(root, `benchmark/artifacts/offline/${task.id}/${condition}`),
        record.trajectoryId
      );
      records.push(record);

      const publicContext = {
        schemaVersion: 1,
        id: task.id,
        family: task.family,
        corpus: task.corpus,
        wording: task.publicTask.wording,
        files: Object.fromEntries(task.publicTask.visibleFiles.map((path) => [path, task.seed.files[path]])),
        publicTests: task.publicTask.publicTests,
        allowedTools: task.publicTask.allowedTools,
        nonGoals: task.publicTask.nonGoals
      };
      const prompt = {
        task: publicContext,
        instruction: "Submit the requested repository change without running checks."
      };
      replayRecords.set(contentHash({
        taskId: task.id,
        condition,
        turn: 0,
        prompt: stableJson(prompt)
      }), response);
      const replay = await runTrajectory({
        task,
        condition,
        model: new ReplayModel({ id: "offline-replay", records: replayRecords }),
        aliasManifest: aliases,
        now
      });
      if (replay.firstSubmission?.sourceHash !== record.firstSubmission?.sourceHash) {
        throw new Error(`offline replay drift for ${task.id}`);
      }
    }

    process.stdout.write(`${stableJson({
      ok: records.every((record) => record.finalHiddenTestPass),
      mode,
      networkCalls: 0,
      providerSpendUsd: 0,
      trajectories: records.length,
      recordHash: contentHash(records)
    })}\n`);
  }
}
