import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64ToGeminiPart(dataUrl: string) {
  // dataUrl can be "data:image/jpeg;base64,..." or raw base64
  if (dataUrl.startsWith("data:")) {
    const match = dataUrl.match(/^data:(.+?);base64,(.+)$/s);
    if (match) {
      return { inlineData: { mimeType: match[1], data: match[2] } };
    }
  }
  // Assume JPEG if no prefix
  return { inlineData: { mimeType: "image/jpeg", data: dataUrl } };
}

const IMAGE_MODELS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
] as const;

async function callGeminiWithFallback(parts: any[], apiKey: string) {
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
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (response.status === 404) {
      lastStatus = 404;
      lastBody = await response.text();
      console.warn(`Gemini model unavailable: ${model}`);
      continue;
    }

    return { response, model };
  }

  throw new Error(`No supported Gemini image model found. Last status: ${lastStatus}. Last body: ${lastBody}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, hairstyle, hairColor, colorTechnique, referenceImage, customPrompt } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not configured");
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

    const { response, model } = await callGeminiWithFallback(parts, GOOGLE_API_KEY);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error(`Gemini API error (${model}):`, response.status, text);
      return new Response(
        JSON.stringify({ error: "AI processing failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const responseParts = data.candidates?.[0]?.content?.parts || [];

    // Find the image part in the response
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
