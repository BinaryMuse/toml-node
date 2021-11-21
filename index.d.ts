declare module 'toml' {
  export function parse<TParsedData = any>(input: string): TParsedData;
}
