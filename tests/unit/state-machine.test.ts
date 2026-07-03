import { describe, expect, it } from "vitest";
import {
  allowedTradeTransitions,
  assertCanTransitionTrade,
  canTransitionTrade,
} from "@/lib/state-machine";

describe("trade state machine", () => {
  it("allows every configured transition", () => {
    for (const [from, targets] of Object.entries(allowedTradeTransitions)) {
      for (const to of targets) {
        expect(canTransitionTrade(from as keyof typeof allowedTradeTransitions, to)).toBe(
          true,
        );
      }
    }
  });

  it("rejects invalid transitions", () => {
    expect(() => assertCanTransitionTrade("DRAFT", "COMPLETED")).toThrow(
      "Trade cannot transition from DRAFT to COMPLETED.",
    );
  });

  it("keeps terminal states terminal", () => {
    expect(allowedTradeTransitions.COMPLETED).toEqual([]);
    expect(allowedTradeTransitions.CANCELLED).toEqual([]);
  });
});
