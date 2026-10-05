import type { ToolcraftComponentAcceptance } from "./acceptance/types";
import { morphAcceptance } from "../morph/morph-acceptance";
import { morphReadiness, morphSectionInventory } from "../morph/morph-inventory";
import { morphTransferMode } from "../morph/morph-reference";

export const appTransferMode = morphTransferMode;

export const appProductReadiness = morphReadiness;

export const appAcceptance: readonly ToolcraftComponentAcceptance[] = morphAcceptance;

// Product entries use the same explicit stable section IDs as appSchema.
export const appControlSectionInventory = morphSectionInventory;
