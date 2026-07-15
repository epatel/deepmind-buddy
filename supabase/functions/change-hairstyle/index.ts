import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GCP_PROJECT = "test-altool";
const GCP_REGION = "europe-west4";

function base64ToGeminiPart(dataUrl: string) {
  if (dataUrl.startsWith("data:")) {
    const match = dataUrl.match(/^data:(.+?);base64,(.+)$/s);
    if (match) {
      return { inlineData: { mimeType: match[1], data: match[2] } };
    }
  }
  return { inlineData: { mimeType: "image/jpeg", data: dataUrl } };
}

const IMAGE_MODELS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
] as const;

const requestBody = (parts: any[]) => ({
  contents: [{ role: "user", parts }],
  generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
});

// Primary: Vertex AI
async function callVertexAI(parts: any[], apiKey: string) {
  let lastStatus = 0;
  let lastBody = "";

  for (const model of IMAGE_MODELS) {
    const url = `https://${GCP_REGION}-aiplatform.googleapis.com/v1beta1/projects/${GCP_PROJECT}/locations/${GCP_REGION}/publishers/google/models/${model}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody(parts)),
    });

    if (response.status === 404) {
      lastStatus = 404;
      lastBody = await response.text();
      console.warn(`Vertex AI model unavailable: ${model}`);
      continue;
    }

    return { response, model, provider: "vertex" as const };
  }

  throw new Error(`Vertex AI: no model found. Last: ${lastStatus} ${lastBody}`);
}

// Fallback: Generative Language API
async function callGenerativeLanguage(parts: any[], apiKey: string) {
  let lastStatus = 0;
  let lastBody = "";

  for (const model of IMAGE_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody(parts)),
    });

    if (response.status === 404) {
      lastStatus = 404;
      lastBody = await response.text();
      console.warn(`GenLang model unavailable: ${model}`);
      continue;
    }

    return { response, model, provider: "genlang" as const };
  }

  throw new Error(`GenLang: no model found. Last: ${lastStatus} ${lastBody}`);
}

async function callWithFallback(parts: any[], vertexKey: string, genlangKey: string) {
  // Try Vertex AI first
  try {
    const result = await callVertexAI(parts, vertexKey);
    if (result.response.ok || (result.response.status !== 429 && result.response.status !== 500 && result.response.status !== 503)) {
      console.log(`Using Vertex AI model: ${result.model}`);
      return result;
    }
    const body = await result.response.text();
    console.warn(`Vertex AI returned ${result.response.status}, falling back to GenLang. Body: ${body}`);
  } catch (e) {
    console.warn(`Vertex AI failed: ${e}, falling back to GenLang`);
  }

  // Fallback to Generative Language API
  console.log("Falling back to Generative Language API");
  return await callGenerativeLanguage(parts, genlangKey);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    if (body.ping) {
      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { imageBase64, hairstyle, hairColor, colorTechnique, referenceImage, customPrompt } = body;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const VERTEX_KEY = Deno.env.get("GOOGLE_VERTEX_API_KEY");
    const GENLANG_KEY = Deno.env.get("GOOGLE_API_KEY");

    if (!VERTEX_KEY && !GENLANG_KEY) {
      throw new Error("No Google API keys configured");
    }

    const colorInstruction = hairColor ? ` Change the hair color to ${hairColor}.` : "";
    const techniqueInstruction = colorTechnique ? ` Apply a ${colorTechnique} coloring technique.` : "";

    let prompt: string;
    const parts: any[] = [];

    if (referenceImage) {
      prompt = `Look at the second image — it shows a reference hairstyle. Apply that exact hairstyle to the person in the first image.${colorInstruction}${techniqueInstruction} Keep the person's face, skin tone, and all other features exactly the same. Only change the hairstyle. Make it look natural and realistic.`;
      parts.push(
        { text: prompt },
        base64ToGeminiPart(imageBase64),
        base64ToGeminiPart(referenceImage)
      );
    } else {
      prompt = customPrompt
        ? `Change this person's hairstyle to: ${customPrompt}.${colorInstruction}${techniqueInstruction} Keep the person's face, skin tone, and all other features exactly the same. Only change the hairstyle and hair color. Make it look natural and realistic.`
        : `Change this person's hairstyle to a ${hairstyle} style.${colorInstruction}${techniqueInstruction} Keep the person's face, skin tone, and all other features exactly the same. Only change the hairstyle and hair color. Make it look natural and realistic.`;
      parts.push(
        { text: prompt },
        base64ToGeminiPart(imageBase64)
      );
    }

    let result;
    if (VERTEX_KEY && GENLANG_KEY) {
      result = await callWithFallback(parts, VERTEX_KEY, GENLANG_KEY);
    } else if (VERTEX_KEY) {
      result = await callVertexAI(parts, VERTEX_KEY);
    } else {
      result = await callGenerativeLanguage(parts, GENLANG_KEY!);
    }

    const { response, model, provider } = result;

    if (!response.ok) {
      const text = await response.text();

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: `API key is invalid or unauthorized (${provider}).` }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 403) {
        return new Response(
          JSON.stringify({ error: `API not enabled or insufficient permissions (${provider}). Check Google Cloud Console.` }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error(`API error (${provider}/${model}):`, response.status, text);
      return new Response(
        JSON.stringify({ error: "AI processing failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const responseParts = data.candidates?.[0]?.content?.parts || [];

    let resultImage: string | null = null;
    let resultText = "";

    for (const part of responseParts) {
      const inline = part.inlineData ?? part.inline_data;
      if (inline?.data) {
        const mime = inline.mimeType || inline.mime_type || "image/png";
        resultImage = `data:${mime};base64,${inline.data}`;
      } else if (part.text) {
        resultText += part.text;
      }
    }

    if (!resultImage) {
      return new Response(
        JSON.stringify({ error: "No image was generated. Try a different hairstyle or photo." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ image: resultImage, message: resultText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("change-hairstyle error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
