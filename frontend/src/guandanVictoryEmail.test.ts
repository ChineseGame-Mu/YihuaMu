import handlerModule from "../api/send-guandan-victory";

const handler = handlerModule as (
  request: { method: string; headers: Record<string, string>; body: unknown },
  response: {
    status: (code: number) => typeof response;
    setHeader: (name: string, value: string) => typeof response;
    end: (body: string) => void;
  },
) => Promise<void>;

const makeResponse = () => {
  let statusCode = 200;
  let responseBody = "";
  const headers: Record<string, string> = {};
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
      return response;
    },
    end(body: string) {
      responseBody = body;
    },
  };
  return {
    response,
    result: () => ({ statusCode, headers, body: JSON.parse(responseBody) }),
  };
};

const validRequest = (ip: string) => ({
  method: "POST",
  headers: {
    origin: "https://yihuagames.com",
    "x-forwarded-for": ip,
  },
  body: {
    to: "player@example.com",
    screenshot: "cG5nLWJ5dGVz",
    room: "1234",
    matchId: 7,
    winnerTeam: "A",
  },
});

describe("Guandan victory screenshot email endpoint", () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalSender = process.env.RESEND_FROM_EMAIL;
  const originalAllowedOrigins = process.env.SCREENSHOT_ALLOWED_ORIGINS;
  const originalVercelUrl = process.env.VERCEL_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalSender === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalSender;
    if (originalAllowedOrigins === undefined)
      delete process.env.SCREENSHOT_ALLOWED_ORIGINS;
    else process.env.SCREENSHOT_ALLOWED_ORIGINS = originalAllowedOrigins;
    if (originalVercelUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = originalVercelUrl;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("refuses the send and reports missing provider configuration", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const { response, result } = makeResponse();

    await handler(validRequest("test-missing-config"), response);

    expect(result().statusCode).toBe(503);
    expect(result().body.error).toContain("截图没有发送");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the configured recipient a PNG attachment through the provider", async () => {
    process.env.RESEND_API_KEY = "test-api-key";
    process.env.RESEND_FROM_EMAIL = "game@example.com";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_test_123" }),
    });
    global.fetch = fetchMock;
    const { response, result } = makeResponse();

    await handler(validRequest("test-success-path"), response);

    expect(result().statusCode).toBe(200);
    expect(result().body).toEqual({ ok: true, id: "email_test_123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    const payload = JSON.parse(String(options.body));
    expect(headers.Authorization).toBe("Bearer test-api-key");
    expect(payload.to).toEqual(["player@example.com"]);
    expect(payload.attachments).toEqual([
      {
        filename: "guandan-ace-victory.png",
        content: "cG5nLWJ5dGVz",
        content_type: "image/png",
      },
    ]);
  });

  it("rejects an invalid address before contacting the provider", async () => {
    process.env.RESEND_API_KEY = "test-api-key";
    process.env.RESEND_FROM_EMAIL = "game@example.com";
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const request = validRequest("test-invalid-email");
    request.body.to = "not-an-email";
    const { response, result } = makeResponse();

    await handler(request, response);

    expect(result().statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the production website origin before validating the payload", async () => {
    delete process.env.SCREENSHOT_ALLOWED_ORIGINS;
    delete process.env.VERCEL_URL;
    process.env.RESEND_API_KEY = "test-api-key";
    process.env.RESEND_FROM_EMAIL = "game@example.com";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_origin_test" }),
    });
    global.fetch = fetchMock;
    const request = validRequest("test-production-origin");
    request.headers.origin = "https://yihuagames.com";
    const { response, result } = makeResponse();

    await handler(request, response);

    expect(result().statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not use the retired Vercel hostname as a production origin", async () => {
    delete process.env.SCREENSHOT_ALLOWED_ORIGINS;
    delete process.env.VERCEL_URL;
    const request = validRequest("test-retired-origin");
    request.headers.origin = "https://yihua-mu.vercel.app";
    const { response, result } = makeResponse();

    await handler(request, response);

    expect(result().statusCode).toBe(403);
  });
});
