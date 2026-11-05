/**
 * The hosted API as a Vercel edge function. scripts/build-vercel.ts bundles
 * this into one self-contained file and deploys it at each of the app's API
 * paths. It reads the data files from the deployment's own static files and
 * passes them on without parsing them.
 */
import { hostedApi } from "../server/hosted";

export default function handler(request: Request): Promise<Response> {
  return hostedApi(request, async (file) => {
    const response = await fetch(new URL(`/data/${file}`, request.url));
    // A fresh response: the fetched one's encoding headers no longer match its decoded body.
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" },
    });
  });
}
