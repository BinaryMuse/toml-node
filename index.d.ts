declare module 'toml' {
  export interface ParseOptions {
    /**
     * Maximum nesting depth for arrays and inline tables. Parsing input nested
     * deeper than this throws a parse error rather than overflowing the stack.
     * Defaults to 500.
     */
    maxDepth?: number;
  }

  export function parse(input: string, options?: ParseOptions): any;
}
