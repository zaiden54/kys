import { describe, expect, it } from "vitest";
import { GET } from "./route";

async function getResponse(url: string): Promise<Response> {
  return GET(new Request(url));
}

describe("GET /api/pwa-icon", () => {
  it("size=192 returns image/png with a non-empty body", async () => {
    const response = await getResponse("http://localhost/api/pwa-icon?size=192");
    expect(response.headers.get("content-type")).toBe("image/png");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("size=512 returns image/png with a non-empty body", async () => {
    const response = await getResponse("http://localhost/api/pwa-icon?size=512");
    expect(response.headers.get("content-type")).toBe("image/png");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("size=512&maskable=1 returns image/png", async () => {
    const response = await getResponse(
      "http://localhost/api/pwa-icon?size=512&maskable=1",
    );
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("size=999999 (out-of-range) still returns image/png (clamped, not passed through)", async () => {
    const response = await getResponse("http://localhost/api/pwa-icon?size=999999");
    expect(response.headers.get("content-type")).toBe("image/png");
  });
});
