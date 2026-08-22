export interface CaddyfileTestParts {
  readonly caddyfile: string;
  readonly delimiterOffset: number;
  readonly remainder: string;
}

const delimiter = /^----------[\t ]*(?:\r?\n|$)/mu;

export function splitCaddyfileTest(text: string): CaddyfileTestParts {
  const match = delimiter.exec(text);
  const delimiterOffset = match?.index ?? text.length;
  return {
    caddyfile: text.slice(0, delimiterOffset),
    delimiterOffset,
    remainder: text.slice(delimiterOffset),
  };
}
