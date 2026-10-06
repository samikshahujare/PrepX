/**
 * NeuralAvatarProvider (Migrated to Local 2D/Canvas Sarah)
 * 
 * Simli, HeyGen, WebRTC remote streaming, and external avatar session dependencies
 * have been permanently removed per the PrepX Local Avatar Architecture.
 * This class now cleanly aliases and delegates to LocalSarah2DAvatarProvider.
 */

import { LocalSarah2DAvatarProvider } from "./LocalSarah2DAvatarProvider";
import { ExternalProviderConfig } from "./types";

export class NeuralAvatarProvider extends LocalSarah2DAvatarProvider {
  constructor(config?: ExternalProviderConfig) {
    super(config);
  }
}
