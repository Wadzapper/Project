import { NextRequest } from 'next/server';
// Polyfill for ReadableStream if not available in the test environment (e.g., older Node versions)
// For modern Node (16.5+), ReadableStream is global.
// If using an older environment, you might need: import { ReadableStream } from 'web-streams-polyfill/ponyfill';
import { encode } from 'querystring';

type MockRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; // Added PATCH
  url?: string;
  headers?: Record<string, string>;
  // For App Router, route params are passed differently, not via query typically.
  // We'll handle route params by embedding them in the URL passed to the handler context.
  query?: Record<string, string | number | string[] | undefined>; // Updated to match NextRequest.nextUrl.searchParams
  body?: any;
  cookies?: Record<string, string>;
  // Context params (like { params: { habitId: '123' } }) will be passed to the handler directly
};

export function createMockRequest({
  method = 'GET',
  url = 'http://localhost/api/test', // Base URL, path params should be part of this
  headers = {},
  query = {},
  body,
  cookies = {},
}: MockRequestOptions = {}): NextRequest {

  const urlObject = new URL(url);

  // Append query parameters to the URL object's searchParams
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach(v => urlObject.searchParams.append(key, v));
      } else {
        urlObject.searchParams.set(key, String(value));
      }
    }
  });

  const fullUrl = urlObject.toString();

  const reqInit: RequestInit = {
    method,
    headers: new Headers(headers), // Use Headers constructor
  };

  if (body !== undefined) {
    if (typeof body === 'object' && !(body instanceof ReadableStream) && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
      reqInit.body = JSON.stringify(body);
      if (!reqInit.headers || !(reqInit.headers instanceof Headers) || !reqInit.headers.has('Content-Type')) {
        (reqInit.headers as Headers).set('Content-Type', 'application/json');
      }
    } else {
      reqInit.body = body; // FormData, ReadableStream, etc.
    }
  }

  const request = new Request(fullUrl, reqInit);

  // Mocking NextRequest specific properties like 'cookies'
  // This is a simplified approach. For full NextRequest behavior, more complex mocking is needed.
  const mockCookies: any = {
    get: (name: string) => {
      const cookie = cookies[name];
      return cookie ? { name, value: cookie } : undefined;
    },
    has: (name: string) => name in cookies,
    getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
    // Add other methods if your handlers use them (e.g., set, delete - though less common for incoming request)
  };

  // A more robust way to mock NextRequest properties if needed:
  const nextRequest = request as NextRequest;

  // Object.defineProperty(nextRequest, 'cookies', {
  //   value: mockCookies,
  //   writable: true,
  //   configurable: true,
  // });

  // For basic use, directly assigning to a new object that extends Request might be enough
  // if the handler only uses simple properties.
  // However, NextRequest is an extension of Request, so direct casting is often done in tests.
  // The key is that the `auth()` function and route handlers receive an object that behaves like NextRequest.

  // A simple way to attach cookies for NextAuth compatibility in tests:
   const finalReq = new NextRequest(request.url, request);
   if (Object.keys(cookies).length > 0) {
     const cookieHeader = Object.entries(cookies)
       .map(([name, value]) => `${name}=${value}`)
       .join('; ');
     finalReq.headers.set('Cookie', cookieHeader);
   }

  return finalReq;
}
