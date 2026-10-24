import { createHandler } from "../../../server/index.mjs";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "https://blaziconhp.github.io";
const env = {
  ...Deno.env.toObject(),
  APP_ORIGIN: allowedOrigin,
  COOKIE_SECURE: "true",
  COOKIE_SAMESITE: "None",
};
const handler = createHandler({ env });

function cors(origin: string | null) {
  const headers = new Headers({
    "Access-Control-Allow-Origin": origin === allowedOrigin ? allowedOrigin : "null",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-bpro-refresh",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Expose-Headers": "x-bpro-access, x-bpro-refresh, x-file-name",
    "Vary": "Origin",
  });
  return headers;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const responseHeaders = cors(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders });
  if (origin !== allowedOrigin) {
    responseHeaders.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify({ error: "Untrusted request origin." }), { status: 403, headers: responseHeaders });
  }

  const originalUrl = new URL(request.url);
  const functionPrefix = "/functions/v1/bpro-api";
  const apiPath = originalUrl.pathname.startsWith(functionPrefix)
    ? originalUrl.pathname.slice(functionPrefix.length) || "/"
    : originalUrl.pathname;
  const url = new URL(`${apiPath}${originalUrl.search}`, "http://bpro-edge.local");
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const refreshToken = request.headers.get("x-bpro-refresh");
  if (accessToken || refreshToken) {
    headers.cookie = [headers.cookie, accessToken ? `bpro_access=${accessToken}` : "", refreshToken ? `bpro_refresh=${refreshToken}` : ""].filter(Boolean).join("; ");
  }
  const bytes = request.method === "GET" || request.method === "HEAD"
    ? new Uint8Array()
    : new Uint8Array(await request.arrayBuffer());
  const req = {
    url: `${url.pathname}${url.search}`,
    method: request.method,
    headers,
    socket: { remoteAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "edge" },
    async *[Symbol.asyncIterator]() { if (bytes.length) yield bytes; },
  };

  let status = 200;
  const responseHeadersFromHandler = new Map<string, string | string[]>();
  let responseBody: Uint8Array | string | undefined;
  const res = {
    headersSent: false,
    setHeader(name: string, value: string | string[]) { responseHeadersFromHandler.set(name.toLowerCase(), value); },
    writeHead(code: number, values: Record<string, string | string[]> = {}) {
      status = code;
      for (const [name, value] of Object.entries(values)) responseHeadersFromHandler.set(name.toLowerCase(), value);
      this.headersSent = true;
    },
    end(value?: Uint8Array | string) { responseBody = value; this.headersSent = true; },
  };
  await handler(req, res);

  const cookieHeaders = responseHeadersFromHandler.get("set-cookie");
  for (const cookie of Array.isArray(cookieHeaders) ? cookieHeaders : cookieHeaders ? [cookieHeaders] : []) {
    const match = cookie.match(/^bpro_(access|refresh)=([^;]*)/);
    if (match) responseHeaders.set(`x-bpro-${match[1]}`, match[2]);
  }

  for (const [name, value] of responseHeadersFromHandler) {
    if (Array.isArray(value)) for (const part of value) responseHeaders.append(name, part);
    else responseHeaders.set(name, value);
  }
  return new Response(responseBody, { status, headers: responseHeaders });
});
