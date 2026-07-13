declare module 'toml' {
  /**
   * A minimal structural subset of the `Temporal` global, used to supply an
   * alternate implementation (e.g. from `@js-temporal/polyfill`) on runtimes
   * without native Temporal support.
   */
  export interface TemporalLike {
    ZonedDateTime: { from(item: string): any };
    PlainDateTime: { from(item: string): any };
    PlainDate: { from(item: string): any };
    PlainTime: { from(item: string): any };
  }

  export interface ParseOptions {
    /**
     * Maximum nesting depth for arrays and inline tables. Parsing input nested
     * deeper than this throws a parse error rather than overflowing the stack.
     * Defaults to 500.
     */
    maxDepth?: number;

    /**
     * When true, date/time values are returned as Temporal objects instead of
     * the default representations:
     *
     * - Offset date-time: `Temporal.ZonedDateTime` (instead of `Date`)
     * - Local date-time:  `Temporal.PlainDateTime` (instead of `string`)
     * - Local date:       `Temporal.PlainDate` (instead of `string`)
     * - Local time:       `Temporal.PlainTime` (instead of `string`)
     *
     * Requires a global `Temporal` object, or an implementation passed via
     * the `temporal` option.
     */
    useTemporal?: boolean;

    /**
     * The Temporal implementation to use when `useTemporal` is set. Defaults
     * to the global `Temporal` object if one is available.
     */
    temporal?: TemporalLike;
  }

  export function parse(input: string, options?: ParseOptions): any;
}
