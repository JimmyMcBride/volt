import { mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { contentHash, stableJson } from "./stable.mjs";

const NANODOLLARS_PER_USD = 1_000_000_000n;
const TOKENS_PER_MILLION = 1_000_000n;

export class SpendError extends Error {
  constructor(message) {
    super(message);
    this.name = "SpendError";
  }
}

function usdToNanodollars(value) {
  if (!Number.isFinite(value) || value < 0) throw new SpendError("USD value must be finite and non-negative");
  return BigInt(Math.round(value * Number(NANODOLLARS_PER_USD)));
}

function nanodollarsToUsd(value) {
  return Number(value) / Number(NANODOLLARS_PER_USD);
}

function tokenCostNanodollars(tokens, usdPerMillion) {
  if (!Number.isInteger(tokens) || tokens < 0) throw new SpendError("tokens must be a non-negative integer");
  const rate = usdToNanodollars(usdPerMillion);
  return (BigInt(tokens) * rate + TOKENS_PER_MILLION - 1n) / TOKENS_PER_MILLION;
}

function priceFor(prices, provider) {
  const price = prices.get(provider);
  if (price === undefined) throw new SpendError(`missing price table entry: ${provider}`);
  return price;
}

export class SpendLedger {
  #ceiling;
  #prices;
  #reservations = new Map();
  #spent = 0n;
  #ambiguous = 0n;
  #requestIds = new Set();
  #entries = [];

  constructor({ maximumSpendUsd, models, requestCeiling = 640 }) {
    this.#ceiling = usdToNanodollars(maximumSpendUsd);
    this.requestCeiling = requestCeiling;
    this.#prices = new Map(models.map((model) => [model.provider, model.priceUsdPerMillion]));
  }

  static restore({ snapshot, models }) {
    const ledger = new SpendLedger({
      maximumSpendUsd: snapshot.maximumSpendUsd,
      models,
      requestCeiling: snapshot.requestCeiling
    });
    ledger.#spent = usdToNanodollars(snapshot.spentUsd);
    ledger.#ambiguous = usdToNanodollars(snapshot.ambiguousReservedUsd);
    ledger.#entries = structuredClone(snapshot.entries);
    ledger.#requestIds = new Set(snapshot.entries.map((entry) => entry.requestId));
    for (const reservation of snapshot.activeReservations) {
      ledger.#reservations.set(reservation.requestId, {
        ...structuredClone(reservation),
        reservedNanodollars: usdToNanodollars(reservation.reservedUsd)
      });
    }
    return ledger;
  }

  reserve({
    requestId,
    trajectoryId,
    provider,
    remainingInputTokens,
    remainingOutputTokens,
    phase = "scheduled"
  }) {
    if (this.#requestIds.has(requestId) || this.#reservations.has(requestId)) {
      throw new SpendError(`request identity already exists: ${requestId}`);
    }
    if (this.#entries.length + this.#reservations.size >= this.requestCeiling) {
      throw new SpendError(`inference request ${this.requestCeiling + 1} is refused`);
    }
    const price = priceFor(this.#prices, provider);
    const reserved =
      tokenCostNanodollars(remainingInputTokens, price.input) +
      tokenCostNanodollars(remainingOutputTokens, price.output);
    const active = [...this.#reservations.values()]
      .reduce((sum, reservation) => sum + reservation.reservedNanodollars, 0n);
    if (this.#spent + this.#ambiguous + active + reserved > this.#ceiling) {
      throw new SpendError("worst-case request reservation would cross the approved spend ceiling");
    }
    const reservation = {
      requestId,
      trajectoryId,
      provider,
      phase,
      remainingInputTokens,
      remainingOutputTokens,
      reservedNanodollars: reserved
    };
    this.#reservations.set(requestId, reservation);
    return {
      requestId,
      reservedUsd: nanodollarsToUsd(reserved),
      availableAfterReservationUsd: nanodollarsToUsd(
        this.#ceiling - this.#spent - this.#ambiguous - active - reserved
      )
    };
  }

  recordSuccess(requestId, usage) {
    const reservation = this.#reservations.get(requestId);
    if (reservation === undefined) throw new SpendError(`request is not reserved: ${requestId}`);
    const { inputTokens, cachedInputTokens, outputTokens } = usage;
    if (![inputTokens, cachedInputTokens, outputTokens].every(
      (value) => Number.isInteger(value) && value >= 0
    )) throw new SpendError("provider usage must contain non-negative integer token counts");
    if (cachedInputTokens > inputTokens) throw new SpendError("cached input cannot exceed total input");
    if (inputTokens > reservation.remainingInputTokens ||
        outputTokens > reservation.remainingOutputTokens) {
      throw new SpendError("provider usage exceeded the reserved trajectory remainder");
    }
    const price = priceFor(this.#prices, reservation.provider);
    const actual =
      tokenCostNanodollars(inputTokens - cachedInputTokens, price.input) +
      tokenCostNanodollars(cachedInputTokens, price.cachedInput ?? price.input) +
      tokenCostNanodollars(outputTokens, price.output);
    if (actual > reservation.reservedNanodollars) {
      throw new SpendError("actual provider charge exceeded its worst-case reservation");
    }
    this.#reservations.delete(requestId);
    this.#requestIds.add(requestId);
    this.#spent += actual;
    const entry = {
      sequence: this.#entries.length + 1,
      requestId,
      trajectoryId: reservation.trajectoryId,
      provider: reservation.provider,
      phase: reservation.phase,
      status: "success",
      inputTokens,
      cachedInputTokens,
      outputTokens,
      chargedUsd: nanodollarsToUsd(actual),
      reservedUsd: nanodollarsToUsd(reservation.reservedNanodollars)
    };
    this.#entries.push(entry);
    return entry;
  }

  recordAmbiguous(requestId, reason) {
    const reservation = this.#reservations.get(requestId);
    if (reservation === undefined) throw new SpendError(`request is not reserved: ${requestId}`);
    this.#reservations.delete(requestId);
    this.#requestIds.add(requestId);
    this.#ambiguous += reservation.reservedNanodollars;
    const entry = {
      sequence: this.#entries.length + 1,
      requestId,
      trajectoryId: reservation.trajectoryId,
      provider: reservation.provider,
      phase: reservation.phase,
      status: "ambiguous_billing",
      reason,
      chargedUsd: null,
      reservedAsAmbiguousUsd: nanodollarsToUsd(reservation.reservedNanodollars)
    };
    this.#entries.push(entry);
    return entry;
  }

  recordUnbilledFailure(requestId, reason) {
    const reservation = this.#reservations.get(requestId);
    if (reservation === undefined) throw new SpendError(`request is not reserved: ${requestId}`);
    this.#reservations.delete(requestId);
    this.#requestIds.add(requestId);
    const entry = {
      sequence: this.#entries.length + 1,
      requestId,
      trajectoryId: reservation.trajectoryId,
      provider: reservation.provider,
      phase: reservation.phase,
      status: "unbilled_failure",
      reason,
      chargedUsd: 0,
      reservedUsd: nanodollarsToUsd(reservation.reservedNanodollars)
    };
    this.#entries.push(entry);
    return entry;
  }

  hasRequest(requestId) {
    return this.#requestIds.has(requestId) || this.#reservations.has(requestId);
  }

  settleInterruptedReservations() {
    return [...this.#reservations.keys()]
      .sort()
      .map((requestId) => this.recordAmbiguous(
        requestId,
        "process interruption after durable reservation; request is never replayed"
      ));
  }

  snapshot() {
    const activeReservations = [...this.#reservations.values()]
      .sort((left, right) => left.requestId.localeCompare(right.requestId))
      .map((reservation) => ({
        requestId: reservation.requestId,
        trajectoryId: reservation.trajectoryId,
        provider: reservation.provider,
        phase: reservation.phase,
        remainingInputTokens: reservation.remainingInputTokens,
        remainingOutputTokens: reservation.remainingOutputTokens,
        reservedUsd: nanodollarsToUsd(reservation.reservedNanodollars)
      }));
    return {
      schemaVersion: 1,
      maximumSpendUsd: nanodollarsToUsd(this.#ceiling),
      spentUsd: nanodollarsToUsd(this.#spent),
      ambiguousReservedUsd: nanodollarsToUsd(this.#ambiguous),
      requestCeiling: this.requestCeiling,
      completedRequestCount: this.#entries.length,
      activeReservations,
      entries: structuredClone(this.#entries)
    };
  }
}

export class CheckpointJournal {
  constructor(path) {
    this.path = path;
    this.sequence = 0;
    this.previousHash = null;
  }

  async append(kind, value) {
    const record = {
      schemaVersion: 1,
      sequence: this.sequence + 1,
      previousHash: this.previousHash,
      kind,
      value
    };
    const hash = contentHash(record);
    const line = `${stableJson({ ...record, hash })}\n`;
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const handle = await open(this.path, "a", 0o600);
    try {
      await handle.writeFile(line, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    this.sequence = record.sequence;
    this.previousHash = hash;
    return { ...record, hash };
  }

  static async load(path) {
    const journal = new CheckpointJournal(path);
    let text;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return { journal, records: [] };
      throw error;
    }
    const records = text.trim() === ""
      ? []
      : text.trimEnd().split("\n").map((line) => JSON.parse(line));
    let previousHash = null;
    for (const [index, record] of records.entries()) {
      if (record.sequence !== index + 1) throw new SpendError("checkpoint sequence is not contiguous");
      if (record.previousHash !== previousHash) throw new SpendError("checkpoint hash chain is broken");
      const { hash, ...unsigned } = record;
      if (contentHash(unsigned) !== hash) throw new SpendError("checkpoint record hash mismatch");
      previousHash = hash;
    }
    journal.sequence = records.length;
    journal.previousHash = previousHash;
    return { journal, records };
  }
}
