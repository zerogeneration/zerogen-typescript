export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: RequestInit["body"];
}

type Reply = Response | Error | ((call: Call) => Response);

/** A fetch that answers from a script of replies and records each call. */
export function fakeFetch(...replies: Reply[]) {
  const calls: Call[] = [];
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    const call: Call = {
      url,
      method: init.method ?? "GET",
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: init.body,
    };
    calls.push(call);
    const reply = replies.shift();
    if (reply === undefined) throw new Error(`Unexpected request: ${call.method} ${url}`);
    if (reply instanceof Error) throw reply;
    return typeof reply === "function" ? reply(call) : reply;
  };
  return { fetch, calls };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Request-Id": "req_test", ...headers },
  });
}

export function apiError(
  status: number,
  code: string,
  options: { retryable?: boolean; param?: string; headers?: Record<string, string> } = {},
): Response {
  return json(
    {
      error: {
        code,
        message: `${code} message`,
        retryable: options.retryable ?? false,
        ...(options.param ? { param: options.param } : {}),
      },
    },
    status,
    options.headers,
  );
}
