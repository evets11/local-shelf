import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/relay/route";

const TOKEN = "t".repeat(40);
const req = (path: string, token?: string) =>
  new Request(`https://example.test/api/relay?path=${encodeURIComponent(path)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("sync relay", () => {
  it("is off without a configured token", async () => {
    vi.stubEnv("SPYDUS_RELAY_TOKEN", "");
    expect((await GET(req("/cgi-bin/spydus.exe/FULL/OPAC/BIBENQ/1/2,3", TOKEN))).status).toBe(404);
  });

  it("rejects a wrong or missing token", async () => {
    vi.stubEnv("SPYDUS_RELAY_TOKEN", TOKEN);
    expect((await GET(req("/cgi-bin/spydus.exe/FULL/OPAC/BIBENQ/1/2,3", "x".repeat(40)))).status).toBe(404);
    expect((await GET(req("/cgi-bin/spydus.exe/FULL/OPAC/BIBENQ/1/2,3"))).status).toBe(404);
  });

  it("only fetches the sync's catalogue paths", async () => {
    vi.stubEnv("SPYDUS_RELAY_TOKEN", TOKEN);
    const f = vi.spyOn(globalThis, "fetch");
    for (const bad of ["/cgi-bin/spydus.exe/MSGTRN/OPAC/HOME", "https://evil.example/", "/../etc", "/cgi-bin/spydus.exe/FULL/OPAC/BIBENQ/../x"])
      expect((await GET(req(bad, TOKEN))).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("fetches an allowed path from the catalogue and passes the status through", async () => {
    vi.stubEnv("SPYDUS_RELAY_TOKEN", TOKEN);
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>ok</html>", { status: 200 }));
    const res = await GET(req("/cgi-bin/spydus.exe/XHLD/OPAC/BIBENQ/123/456", TOKEN));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<html>ok</html>");
    expect(String(f.mock.calls[0][0])).toBe("https://brighton-hove.spydus.co.uk/cgi-bin/spydus.exe/XHLD/OPAC/BIBENQ/123/456");

    f.mockResolvedValue(new Response("busy", { status: 503 }));
    expect((await GET(req("/cgi-bin/spydus.exe/PAGE/OPAC/BIBENQ/123/2", TOKEN))).status).toBe(503);
  });
});
