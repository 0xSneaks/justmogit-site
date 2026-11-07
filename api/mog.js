// POST /api/mog — JustMogIt PFP changer endpoint (Vercel serverless function).
//
// Takes { image: <data URL or base64>, style: "vipers" | "glitch" | "cat" },
// runs the edit through the Gemini image model, and returns
// { image: <data URL> }.
//
// The Gemini key comes ONLY from the GEMINI_API_KEY environment variable
// (set it in the Vercel project: Settings → Environment Variables).
// No key is ever stored in this repo. If the variable is absent the
// endpoint returns a clean 503 { error: "key_not_configured" } and the
// page shows its friendly "being wired up" state.

const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  GEMINI_MODEL +
  ":generateContent";

const PROMPTS = {
  vipers:
    "Edit this profile picture: add wraparound shield sport sunglasses to the " +
    "face. Draw the sunglasses in exactly the same art style as the input image " +
    "(a photo stays a photo, a cartoon stays a cartoon, pixel art stays pixel " +
    "art, 3D stays 3D). Fit them to the face: sized to the head, centered on the " +
    "eyes, following the head's angle and tilt, with the arms going back behind " +
    "the ears or hair. Take the frame and lens colours from the picture's own " +
    "palette. No text, letters, logos or brand names anywhere on the frames or " +
    "lenses. Keep the face, identity, pose, clothing and background otherwise " +
    "unchanged. Square 1:1 profile picture.",
  glitch:
    "Transform this photo into a bold glitch-anime profile picture: convert the " +
    "person into an anime illustration with a dark silhouette face, oversized " +
    "hot-pink wraparound shield sport sunglasses with no text or logos on the " +
    "frames, vivid RGB-split glitch slices and " +
    "neon pink, cyan and yellow streak artifacts exploding outward, high " +
    "contrast, clean light background, and the words GET MOGGED in chunky italic " +
    "block letters along the bottom. Square 1:1 avatar composition, face centered.",
  cat:
    "Transform the person in this photo into a 3D animated yellow tiger cat " +
    "character (Pixar-style render) wearing oversized rainbow-lens wraparound " +
    "shield sport sunglasses with no text or logos on the frames, with joyful " +
    "cry-laughing tear streaks, tiny fangs showing in a " +
    "big grin, pointing one paw straight at the viewer. Bright yellow background " +
    "with subtle halftone dots. Square 1:1 profile picture, character centered."
};

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {};
      }
    }
    return req.body;
  }
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 14 * 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function parseImage(input, fallbackMime) {
  if (typeof input !== "string" || !input) return null;
  const m = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (m) return { mimeType: m[1], data: m[2].replace(/\s/g, "") };
  // Bare base64 with an explicit mime type alongside.
  if (/^[A-Za-z0-9+/=\s]+$/.test(input) && fallbackMime) {
    return { mimeType: fallbackMime, data: input.replace(/\s/g, "") };
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "method_not_allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return send(res, 503, { error: "key_not_configured" });
  }

  const body = await readBody(req);
  const style = PROMPTS[body.style] ? body.style : null;
  if (!style) {
    return send(res, 400, { error: "unknown_style" });
  }
  const image = parseImage(body.image, body.mimeType);
  if (!image) {
    return send(res, 400, { error: "image_required" });
  }
  if (image.data.length > 11 * 1024 * 1024) {
    return send(res, 413, { error: "image_too_large" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);

  let upstream;
  try {
    upstream = await fetch(GEMINI_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPTS[style] },
              { inline_data: { mime_type: image.mimeType, data: image.data } }
            ]
          }
        ]
      })
    });
  } catch (e) {
    clearTimeout(timer);
    return send(res, 502, { error: "upstream_error" });
  }
  clearTimeout(timer);

  if (!upstream.ok) {
    return send(res, 502, { error: "upstream_error", status: upstream.status });
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch (e) {
    return send(res, 502, { error: "upstream_error" });
  }

  const parts =
    payload &&
    payload.candidates &&
    payload.candidates[0] &&
    payload.candidates[0].content &&
    payload.candidates[0].content.parts;

  if (Array.isArray(parts)) {
    for (const part of parts) {
      const inline = part.inlineData || part.inline_data;
      if (inline && inline.data) {
        const mime = inline.mimeType || inline.mime_type || "image/png";
        return send(res, 200, {
          image: "data:" + mime + ";base64," + inline.data,
          style: style
        });
      }
    }
  }

  return send(res, 502, { error: "no_image_returned" });
};
