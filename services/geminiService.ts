
import { GoogleGenAI, Modality } from "@google/genai";
import { NewsSource, UploadedFile, Language, ArticleLength, AdvancedSettings, ArticleTone, NewsArticle, MediaItem, RawSourceChunk } from "../types";

let geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
let ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

export const setGeminiApiKey = (key: string) => {
  geminiApiKey = key;
  ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
};

const requireAiClient = () => {
  if (!ai) {
    throw new Error("Gemini API Key no configurada. Abre la Configuración del Proyecto para agregarla.");
  }
  return ai;
};

// --- HELPER: Normalizar contenido a Markdown (sin HTML) ---
const normalizeToMarkdown = (input: string): string => {
  if (!input) return "";

  let text = input.replace(/\r\n/g, "\n");

  // 1) Convertir cabeceras HTML <h1>-<h6> a encabezados Markdown (#, ##, ###, ...)
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, inner) => {
    const hashes = "#".repeat(Number(level));
    return `${hashes} ${String(inner).trim()}`;
  });

  // 2) Saltos de línea explícitos
  text = text.replace(/<br\s*\/?>(\s*)/gi, "\n");

  // 3) Párrafos: quitar <p> de apertura y convertir </p> en doble salto de línea
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "\n\n");

  // 4) Negritas: <strong>/<b> -> **texto**
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, (_m, _tagOpen, inner) => {
    return `**${String(inner).trim()}**`;
  });

  // 5) Cursiva: <em>/<i> -> *texto*
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, (_m, _tagOpen, inner) => {
    return `*${String(inner).trim()}*`;
  });

  // 6) Enlaces: <a href="url">texto</a> -> [texto](url)
  text = text.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => {
    const label = String(inner).trim() || href;
    return `[${label}](${href})`;
  });

  // 7) Citas: <blockquote> -> líneas con '>'
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner) => {
    const raw = String(inner).replace(/\r\n/g, "\n");
    return raw
      .split(/\n/)
      .map((line: string) => (line.trim() ? `> ${line.trim()}` : ""))
      .join("\n");
  });

  // 8) Listas: <li> -> "- item"; quitar <ul>/<ol>
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => {
    const content = String(inner).trim();
    return content ? `- ${content}\n` : "";
  });
  text = text.replace(/<\/?(ul|ol)[^>]*>/gi, "");

  // 9) Eliminar cualquier otra etiqueta HTML restante dejando solo el texto interno
  text = text.replace(/<\/?[^>]+>/g, "");

  // 10) Normalizar saltos de línea múltiples
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
};

// --- HELPER: Convert Raw PCM to WAV Blob URL for playback ---
const pcmToWavBlob = (rawBase64: string, sampleRate: number = 24000): string => {
  const binaryString = atob(rawBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // PCM data is 16-bit integers (Little Endian)
  const dataLen = bytes.length;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  writeString(view, 8, 'WAVE');
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLen, true);

  const wavBytes = new Uint8Array(wavHeader.byteLength + dataLen);
  wavBytes.set(new Uint8Array(wavHeader), 0);
  wavBytes.set(bytes, 44);

  const blob = new Blob([wavBytes], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// --- HELPER: Convert Blob to Base64 ---
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- 1. TEXT GENERATION (WITH SEARCH OR FILE) ---
export const generateNewsContent = async (
    input: string, 
    mode: 'topic' | 'document', 
    file: UploadedFile | null,
    language: Language,
    length: ArticleLength,
    settings: AdvancedSettings
): Promise<{ 
    title: string, 
    content: string, 
    sources: NewsSource[], 
    imagePrompt: string,
    keywords: string[],
    metaDescription: string,
    rawSourceChunks: RawSourceChunk[]
}> => {
  try {
    const client = requireAiClient();
    let contents: any[] = [];
    let tools: any[] = [];
    
    const langNames = { 'es': 'Spanish', 'en': 'English', 'fr': 'French', 'pt': 'Portuguese', 'de': 'German' };
    const targetLang = langNames[language];
    
    const lengthGuide = { 'short': 'approx 300 words', 'medium': 'approx 600 words', 'long': 'approx 1000 words' };

    // Construct complex prompt based on settings
    const systemPrompt = `You are a world-class journalist engine. 
    Target Language: ${targetLang}.
    Target Length: ${lengthGuide[length]}.
    
    STYLE CONFIGURATION:
    - Tone: ${settings.tone.toUpperCase()}
    - Target Audience: ${settings.audience.toUpperCase()}
    - Editorial Focus (Angle): ${settings.focus.toUpperCase()}
    
    SOURCE QUALITY BASELINE (ALWAYS ENFORCED):
    - When using external information or news coverage, always rely on reputable, well-known news outlets and official institutions.
    - Avoid blogs, forums, tabloids, and low-credibility websites as primary sources.
    
    CONTENT REQUIREMENTS (STRICT):
    ${settings.includeQuotes ? '- MUST include direct quotes (with attribution) from relevant figures or documents.' : ''}
    ${settings.includeStats ? '- MUST include specific data, statistics, percentages, or financial figures.' : ''}
    ${settings.includeCounterArguments ? '- MUST include a counter-argument, alternative perspective, or risks involved to ensure balance.' : ''}
    
    Task: Write a news article following these constraints.
    
    Structure the response with these EXACT separators:
    |||HEADLINE|||
    (Write the catchy headline here)
    |||BODY|||
    (Write the article body in Markdown here. Use H3 for subheaders.)
    |||IMAGE_PROMPT|||
    (Write a highly detailed English prompt for an image generator. It must vividly describe the main subject, scene, or metaphor of the article based on the content you just wrote. Include specific details about the environment, lighting, color palette, and mood to match the article's tone. Style constraint: ${settings.visualStyle})
    |||METADATA|||
    (Provide a valid JSON object with "keywords" (array of strings) and "metaDescription" (string))`;

    if (mode === 'document' && file) {
        // Document Analysis Mode
        contents = [
            { inlineData: { mimeType: file.mimeType, data: file.data } },
            { text: `${systemPrompt}\n\nSource Material Provided. Instruction: ${input || "Create a story based on this document."}` }
        ];
    } else {
        // Topic Search Mode
        let searchContext = `Topic: "${input}".`;
        
        // TimeFrame
        if (settings.timeFrame !== 'any') {
            searchContext += ` Focus on events from the last ${settings.timeFrame}.`;
        }

        // Region Logic
        const regionInstructions = {
            'world': 'Use global sources.',
            'us': 'Prioritize US-based Tier 1 sources (e.g., NYT, WSJ, Washington Post). Ignore derivative content.',
            'eu': 'Prioritize European sources (e.g., BBC, DW, Le Monde, El Pais).',
            'latam': 'Prioritize Latin American sources.',
            'asia': 'Prioritize Asian sources.'
        };
        searchContext += ` ${regionInstructions[settings.sourceRegion]}`;

        // Preferred Sources (Domains)
        if (settings.preferredDomains.length > 0) {
            searchContext += ` Give preference to these vetted domains when available: ${settings.preferredDomains.join(', ')}. You may still cite other reputable, well-sourced outlets if they strengthen the story.`;
        }

        // Blocked Sources
        if (settings.blockedDomains.length > 0) {
            searchContext += ` Do NOT use information from these domains: ${settings.blockedDomains.join(', ')}.`;
        }

        // Verified Only
        if (settings.verifiedSourcesOnly) {
            searchContext += ` STRICTLY use only verified, authoritative, and reputable news sources. Do not use blogs, forums, or tabloid sites.`;
        }

        contents = [
            { text: `${systemPrompt}\n\n${searchContext}` }
        ];
        tools = [{ googleSearch: {} }];
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        tools: tools.length > 0 ? tools : undefined,
      }
    });

    const fullText = response.text || "";
    
    // Robust Parsing with new sections
    const parts = fullText.split(/\|\|\|[A-Z_]+\|\|\|/);
    
    // Indices shift due to new sections:
    // 0: Empty
    // 1: HEADLINE
    // 2: BODY
    // 3: IMAGE_PROMPT
    // 4: METADATA

    const title = parts[1]?.trim() || "Noticia Generada";
    const rawContent = parts[2]?.trim() || fullText;
    const content = normalizeToMarkdown(rawContent);
    const imagePrompt = parts[3]?.trim() || `Editorial illustration representing ${input}, detailed, ${settings.visualStyle} style`;
    const metadataRaw = parts[4]?.trim() || "{}";
    
    let keywords: string[] = [];
    let metaDescription = "";
    
    try {
        const jsonStr = metadataRaw.replace(/```json|```/g, '');
        const metadata = JSON.parse(jsonStr);
        keywords = metadata.keywords || [];
        metaDescription = metadata.metaDescription || "";
    } catch (e) {
        console.warn("Failed to parse metadata JSON", e);
    }

    // Extract Grounding Metadata with Robust Filtering
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

    // Intelligent Deduplication & Filtering
    const uniqueSources: NewsSource[] = [];
    const seenUris = new Set<string>();
    const seenTitles = new Set<string>();

    for (const source of rawSources) {
        const uri = source.uri;
        const isVertexRedirect = uri.includes('vertexaisearch');
        const isGoogleSearch = uri.includes('google.com/search') || uri.includes('google.com/url');

        // Still drop generic Google search result URLs, as they are not good final citations
        if (isGoogleSearch) {
            continue;
        }

        // Normalize Title / Label
        let title = source.title.trim();

        // For Vertex redirect URLs, we trust the title to represent the external site (often the domain),
        // so we avoid normalizing it to the vertexaisearch hostname.
        if (!isVertexRedirect) {
            // If title looks like a URL or is too long, try to fallback to domain
            if (title.includes('http') || title.includes('www.') || title.length > 100) {
                try {
                    const hostname = new URL(uri).hostname;
                    title = hostname.replace('www.', '');
                } catch (e) {
                    // Keep original if parsing fails
                }
            }
        }

        // Dedupe Logic: Must have unique URI AND unique Title to be added
        // This prevents same-article-different-url AND same-url-duplicate-entry
        if (!seenUris.has(uri) && !seenTitles.has(title)) {
            seenUris.add(uri);
            seenTitles.add(title);
            uniqueSources.push({ title, uri });
        }
    }

    if (mode === 'document' && file) {
        uniqueSources.push({ title: file.name, uri: '#' });
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

// --- 2. IMAGE GENERATION ---
export const generateNewsImages = async (prompt: string): Promise<string[]> => {
  try {
    const client = requireAiClient();
    const response = await client.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 3,
        aspectRatio: '16:9',
        outputMimeType: 'image/jpeg'
      }
    });

    if (!response.generatedImages) throw new Error("No images generated");
    
    return response.generatedImages.map(img => img.image.imageBytes);
  } catch (error) {
    console.error("Error generating images:", error);
    return [];
  }
};

// --- 3. AUDIO GENERATION (TTS) ---
// Now aware of AdvancedSettings to pick the right "Voice Persona"
export const generateNewsAudio = async (text: string, language: Language, settings: AdvancedSettings): Promise<string> => {
  try {
    const client = requireAiClient();
    let selectedVoice = 'Aoede'; // Default Safe option

    // 1. Define Voice Personas based on Tone
    const voiceByTone: Record<ArticleTone, string> = {
        'objective': 'Fenrir',   // Serious news anchor
        'corporate': 'Fenrir',   // Authoritative
        'editorial': 'Aoede',    // Opinionated but smooth
        'narrative': 'Aoede',    // Storyteller
        'explanatory': 'Zephyr', // Helpful/Clear
        'sensational': 'Puck',   // Energetic/Urgent
        'satirical': 'Puck'      // Playful
    };

    // 2. Apply selection logic
    if (settings && settings.tone) {
        selectedVoice = voiceByTone[settings.tone] || 'Aoede';
    }

    // Increased limit to 40,000 characters to prevent truncation
    const safeText = text.length > 40000 ? text.substring(0, 40000) + "..." : text;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: safeText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");
    
    return pcmToWavBlob(base64Audio, 24000); 
  } catch (error) {
    console.error("Error generating audio:", error);
    throw error;
  }
};

// --- 4. SOCIAL MEDIA POST GENERATOR ---
export const generateSocialPost = async (article: NewsArticle, platform: 'x' | 'linkedin' | 'facebook'): Promise<string> => {
    try {
        const client = requireAiClient();
        const prompt = `
        Role: Expert Social Media Manager.
        Task: Convert the following news article into a viral post for ${platform === 'x' ? 'X (Twitter)' : platform === 'linkedin' ? 'LinkedIn' : 'Facebook'}.
        Language: ${article.language === 'en' ? 'English' : 'Spanish'} (Match article language).
        
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
            model: 'gemini-2.5-flash',
            contents: prompt
        });

        return response.text || "Error generando post.";
    } catch (error) {
        console.error("Error generating social post:", error);
        return "No se pudo generar el post para redes sociales.";
    }
};
