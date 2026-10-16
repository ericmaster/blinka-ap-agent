// Generic port/adapter pattern. No domain logic.
export interface Port<Req, Res> {
  call(req: Req): Promise<Res>;
}
export type Mode = "real" | "fake";
export function selectAdapter<Req, Res>(real: Port<Req, Res>, fake: Port<Req, Res>, mode: Mode = (process.env.ADAPTER_MODE as Mode) ?? "fake"): Port<Req, Res> {
  return mode === "real" ? real : fake;
}
