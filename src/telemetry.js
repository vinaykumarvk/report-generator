/**
 * Lightweight telemetry hub that fans out lifecycle events to registered
 * listeners. Designed to expose call-level metrics to orchestrators or
 * external observers without imposing a logging dependency.
 */
class TelemetryHub {
  /**
   * @param {Array<Partial<LLMTelemetryListener>>} [listeners]
   */
  constructor(listeners = []) {
    this.listeners = Array.isArray(listeners) ? [...listeners] : [];
  }

  /**
   * @param {Partial<LLMTelemetryListener>} listener
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * @param {LLMTelemetryStartEvent} event
   */
  emitStart(event) {
    this.listeners.forEach((listener) => listener.onCallStart?.(event));
  }

  /**
   * @param {LLMTelemetrySuccessEvent} event
   */
  emitSuccess(event) {
    this.listeners.forEach((listener) => listener.onCallSuccess?.(event));
  }

  /**
   * @param {LLMTelemetryErrorEvent} event
   */
  emitError(event) {
    this.listeners.forEach((listener) => listener.onCallError?.(event));
  }
}

/**
 * @typedef {Object} LLMTelemetryListener
 * @property {(event: LLMTelemetryStartEvent) => void} [onCallStart]
 * @property {(event: LLMTelemetrySuccessEvent) => void} [onCallSuccess]
 * @property {(event: LLMTelemetryErrorEvent) => void} [onCallError]
 */

/**
 * @typedef {Object} LLMTelemetryStartEvent
 * @property {string} provider
 * @property {string} model
 * @property {string} callId
 * @property {number} attempt
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} LLMTelemetrySuccessEvent
 * @property {string} provider
 * @property {string} model
 * @property {string} callId
 * @property {number} attempt
 * @property {number} durationMs
 * @property {number} promptTokens
 * @property {number} completionTokens
 * @property {number} totalTokens
 * @property {number} costUsd
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} LLMTelemetryErrorEvent
 * @property {string} provider
 * @property {string} model
 * @property {string} callId
 * @property {number} attempt
 * @property {unknown} error
 * @property {Record<string, unknown>} [metadata]
 */

module.exports = { TelemetryHub };
