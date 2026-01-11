import { GoogleGenAI, Modality } from "@google/genai";
import { NewsSource, UploadedFile, Language, ArticleLength, AdvancedSettings, ArticleTone, NewsArticle, MediaItem, RawSourceChunk, ImageModel } from "../types";

let geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
let ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey, apiVersion: "v1" }) : null;

export const setGeminiApiKey = (key: string) => {
  geminiApiKey = key;
  ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey, apiVersion: "v1" }) : null;
};

const requireAiClient = () => {
  if (!ai) {
    throw new Error("Gemini API Key no configurada. Abre la Configuración del Proyecto para agregarla.");
  }
  return ai;
};

const normalizeToMarkdown = (input: string): string => {
  if (!input) return "";

  let text = input.replace(/\r\n/g, "\n");

  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, inner) => {
    const hashes = "#".repeat(Number(level));
    return `${hashes} ${String(inner).trim()}`;
  });

  text = text.replace(/<br\s*\/?>(\s*)/gi, "\n");

  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "\n\n");

  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, (_m, _tagOpen, inner) => {
    return `**${String(inner).trim()}**`;
  });

  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, (_m, _tagOpen, inner) => {
    return `*${String(inner).trim()}*`;
  });

  text = text.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => {
    const label = String(inner).trim() || href;
    return `[${label}](${href})`;
  });

  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner) => {
    const raw = String(inner).replace(/\r\n/g, "\n");
    return raw
      .split(/\n/)
      .map((line: string) => (line.trim() ? `> ${line.trim()}` : ""))
      .join("\n");
  });

  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => {
    const content = String(inner).trim();
    return content ? `- ${content}\n` : "";
  });
  text = text.replace(/<\/?(ul|ol)[^>]*>/gi, "");

  text = text.replace(/<\/?[^>]+>/g, "");

  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
};

const pcmToWavBlob = (rawBase64: string, sampleRate: number = 24000): string => {
  const binaryString = atob(rawBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const dataLen = bytes.length;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLen, true);

  const wavBytes = new Uint8Array(wavHeader.byteLength + dataLen);
  wavBytes.set(new Uint8Array(wavHeader), 0);
  wavBytes.set(bytes, 44);

  const blob = new Blob([wavBytes], { type: "audio/wav" });
  return URL.createObjectURL(blob);
};

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(",")[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generateNewsContent = async (
  input: string,
  mode: "topic" | "document",
  file: UploadedFile | null,
  language: Language,
  length: ArticleLength,
  settings: AdvancedSettings
): Promise<{
  title: string;
  content: string;
  sources: NewsSource[];
  imagePrompt: string;
  keywords: string[];
  metaDescription: string;
  rawSourceChunks: RawSourceChunk[];
}> => {
  try {
    const client = requireAiClient();
    let contents: any[] = [];

    const langNames = { es: "Spanish", en: "English", fr: "French", pt: "Portuguese", de: "German" };
    const targetLang = langNames[language];

    const lengthGuide = { short: "approx 300 words", medium: "approx 600 words", long: "approx 1000 words" };

    const systemPrompt = `You are a world-class journalist engine. 
    Target Language: ${targetLang}.
    Target Length: ${lengthGuide[length]}.
    
    STYLE CONFIGURATION:
    - Tone: ${settings.tone.toUpperCase()}
    - Target Audience: ${settings.audience.toUpperCase()}
    - Editorial Focus (Angle): ${settings.focus.toUpperCase()}
    
    Task: Write a news article following these constraints. Use your internal knowledge to provide accurate and verifiable information. Cite at least two reliable sources with URLs (prioritize reputable outlets) and mention the domain with each quote.
    
    Structure the response with these EXACT separators:
    |||HEADLINE|||
    (Write the catchy headline here)
    |||BODY|||
    (Write the article body in Markdown here. Use H3 for subheaders and include inline citations.)
    |||IMAGE_PROMPT|||
    (Write a highly detailed English prompt for an image generator.)
    |||METADATA|||
    (Provide a valid JSON object with "keywords" (array of strings) and "metaDescription" (string))`;

    if (mode === "document" && file) {
      contents = [
        { inlineData: { mimeType: file.mimeType, data: file.data } },
        { text: `${systemPrompt}\n\nSource Material Provided. Instruction: ${input || "Create a story based on this document."}` }
      ];
    } else {
      let userPrompt = `Topic: "${input}".`;

      if (settings.timeFrame !== "any") {
        userPrompt += ` Focus on events from the last ${settings.timeFrame} if possible.`;
      }

      contents = [{ text: `${systemPrompt}\n\n${userPrompt}` }];
    }

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash", // Use balanced flash model that tends to include citations
      contents
    });

    const fullText = response.text || "";
    const parts = fullText.split(/\|\|\|[A-Z_]+\|\|\|/);

    const title = parts[1]?.trim() || "Noticia Generada";
    const rawContent = parts[2]?.trim() || fullText;
    const content = normalizeToMarkdown(rawContent);
    const imagePrompt = parts[3]?.trim() || `Editorial illustration representing ${input}`;
    const metadataRaw = parts[4]?.trim() || "{}";

    let keywords: string[] = [];
    let metaDescription = "";

    try {
      const jsonStr = metadataRaw.replace(/```json|```/g, "");
      const metadata = JSON.parse(jsonStr);
      keywords = metadata.keywords || [];
      metaDescription = metadata.metaDescription || "";
    } catch (e) {
      console.warn("Failed to parse metadata JSON", e);
    }

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const rawSourceChunks: RawSourceChunk[] = chunks.map((c: any) => ({
      title: c.web?.title || null,
      uri: c.web?.uri || null,
      snippet: c.web?.snippet || null,
      provider: c.web?.provider || null
    }));

    const rawSources = rawSourceChunks
      .map((chunk) => {
        if (chunk.uri && chunk.title) {
          return { title: chunk.title, uri: chunk.uri };
        }
        return null;
      })
      .filter((s): s is { title: string; uri: string } => s !== null);

    const uniqueSources: NewsSource[] = [];
    const seenUris = new Set<string>();
    const seenTitles = new Set<string>();

    for (const source of rawSources) {
      const uri = source.uri;
      const isVertexRedirect = uri.includes("vertexaisearch");
      const isGoogleSearch = uri.includes("google.com/search") || uri.includes("google.com/url");

      if (isGoogleSearch) {
        continue;
      }

      let titleLabel = source.title.trim();

      if (!isVertexRedirect) {
        if (titleLabel.includes("http") || titleLabel.includes("www.") || titleLabel.length > 100) {
          try {
            const hostname = new URL(uri).hostname;
            titleLabel = hostname.replace("www.", "");
          } catch (e) {
          }
        }
      }

      if (!seenUris.has(uri) && !seenTitles.has(titleLabel)) {
        seenUris.add(uri);
        seenTitles.add(titleLabel);
        uniqueSources.push({ title: titleLabel, uri });
      }
    }

    if (mode === "document" && file) {
      uniqueSources.push({ title: file.name, uri: "#" });
    }

    return {
      title,
      content,
      imagePrompt,
      sources: uniqueSources,
      keywords,
      metaDescription,
      rawSourceChunks
    };
  } catch (error) {
    console.error("Error generating text:", error);
    throw error;
  }
};

export const generateNewsImages = async (prompt: string, model: ImageModel = "gemini-2.5-flash-image"): Promise<string[]> => {
  try {
    const client = requireAiClient();
    const response = await client.models.generateImages({
      model,
      prompt,
      config: {
        numberOfImages: 3,
        aspectRatio: "16:9",
        outputMimeType: "image/jpeg"
      }
    });

    if (!response.generatedImages) throw new Error("No images generated");

    return response.generatedImages.map((img: any) => img.image.imageBytes);
  } catch (error) {
    console.error("Error generating images:", error);
    return [];
  }
};

export const generateNewsAudio = async (text: string, language: Language, settings: AdvancedSettings): Promise<string> => {
  try {
    const client = requireAiClient();
    let selectedVoice = "Aoede";

    const voiceByTone: Record<ArticleTone, string> = {
      objective: "Fenrir",
      corporate: "Fenrir",
      editorial: "Aoede",
      narrative: "Aoede",
      explanatory: "Zephyr",
      sensational: "Puck",
      satirical: "Puck"
    };

    if (settings && settings.tone) {
      selectedVoice = voiceByTone[settings.tone] || "Aoede";
    }

    const safeText = text.length > 40000 ? text.substring(0, 40000) + "..." : text;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: safeText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");

    return pcmToWavBlob(base64Audio, 24000);
  } catch (error) {
    console.error("Error generating audio:", error);
    throw error;
  }
};

export const generateSocialPost = async (article: NewsArticle, platform: "x" | "linkedin" | "facebook"): Promise<string> => {
  try {
    const client = requireAiClient();
    const prompt = `
        Role: Expert Social Media Manager.
        Task: Convert the following news article into a viral post for ${platform === "x" ? "X (Twitter)" : platform === "linkedin" ? "LinkedIn" : "Facebook"}.
        Language: ${article.language === "en" ? "English" : "Spanish"} (Match article language).
        
        ARTICLE TITLE: ${article.title}
        ARTICLE CONTENT (Summary): ${article.metaDescription}
        
        REQUIREMENTS FOR X (TWITTER):
        - STRICT LIMIT: Maximum 2 tweets. Ideally just 1 powerful tweet.
        - Max 280 characters per tweet.
        - Use 2 relevant viral hashtags max.
        - Tone: Urgent, provocative, concise.
        - Structure: Hook + Core Insight + Link placeholder.
        
        REQUIREMENTS FOR LINKEDIN:
        - Professional, insightful structure.
        - Use a "Hook" headline.
        - Use bullet points for key insights.
        - End with a thought-provoking question to drive engagement.
        
        REQUIREMENTS FOR FACEBOOK:
        - Conversational, community-focused, and engaging tone.
        - Length: Medium (1-2 paragraphs). Facebook allows more text than X.
        - Focus on the "human story" or impact.
        - Ask a question to the followers to encourage comments.
        - Use relevant emojis.
        
        IMPORTANT: Return ONLY the text of the post. Do not include labels like "Here is the post:" or markdown headers like "### Post". Just the content ready to copy/paste.
        `;
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    return response.text || "Error generando post.";
  } catch (error) {
    console.error("Error generating social post:", error);
    return "No se pudo generar el post para redes sociales.";
  }
};
