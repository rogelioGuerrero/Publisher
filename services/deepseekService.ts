import { 
  Language, 
  ArticleLength, 
  AdvancedSettings, 
  NewsSource, 
  RawSourceChunk, 
  UploadedFile,
  NewsArticle
} from "../types";

let deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY || "";

export const setDeepseekApiKey = (key: string) => {
  deepseekApiKey = key;
};

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

const fetchDeepseek = async (messages: any[], temperature = 0.7) => {
  if (!deepseekApiKey) {
    throw new Error("DeepSeek API Key no configurada.");
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${deepseekApiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Error en DeepSeek API");
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

export const generateArticleWithDeepseek = async (
  input: string,
  language: Language,
  length: ArticleLength,
  settings: AdvancedSettings,
  mode: "topic" | "document" = "topic"
): Promise<{
  title: string;
  content: string;
  imagePrompt: string;
  keywords: string[];
  metaDescription: string;
}> => {
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
  
  CONTENT REQUIREMENTS (STRICT):
  ${settings.includeQuotes ? "- MUST include direct quotes (with attribution) from relevant figures or documents." : ""}
  ${settings.includeStats ? "- MUST include specific data, statistics, percentages, or financial figures." : ""}
  ${settings.includeCounterArguments ? "- MUST include a counter-argument, alternative perspective, or risks involved to ensure balance." : ""}
  
  Task: Write a news article following these constraints. Use your internal knowledge to provide accurate and verifiable information.
  
  Structure the response with these EXACT separators:
  |||HEADLINE|||
  (Write the catchy headline here)
  |||BODY|||
  (Write the article body in Markdown here. Use H3 for subheaders.)
  |||IMAGE_PROMPT|||
  (Write a highly detailed English prompt for an image generator.)
  |||METADATA|||
  (Provide a valid JSON object with "keywords" (array of strings) and "metaDescription" (string))`;

  const userPrompt = `Topic/Input: ${input}`;

  const fullText = await fetchDeepseek([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  const parts = fullText.split(/\|\|\|[A-Z_]+\|\|\|/);
  const title = parts[1]?.trim() || "Noticia Generada";
  const content = parts[2]?.trim() || fullText;
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

  return { title, content, imagePrompt, keywords, metaDescription };
};

export const generateSocialPostWithDeepseek = async (article: NewsArticle, platform: "x" | "linkedin" | "facebook"): Promise<string> => {
  const prompt = `
    Role: Expert Social Media Manager.
    Task: Convert the following news article into a viral post for ${platform === "x" ? "X (Twitter)" : platform === "linkedin" ? "LinkedIn" : "Facebook"}.
    Language: ${article.language === "en" ? "English" : "Spanish"} (Match article language).
    
    ARTICLE TITLE: ${article.title}
    ARTICLE CONTENT (Summary): ${article.metaDescription}
    
    REQUIREMENTS FOR X (TWITTER):
    - STRICT LIMIT: Maximum 1-2 powerful tweets.
    - Max 280 characters per tweet.
    - Use 2 relevant viral hashtags max.
    - Tone: Urgent, provocative, concise.
    
    REQUIREMENTS FOR LINKEDIN:
    - Professional, insightful structure.
    - Use a "Hook" headline.
    - Use bullet points for key insights.
    
    REQUIREMENTS FOR FACEBOOK:
    - Conversational, community-focused, and engaging tone.
    - Medium length (1-2 paragraphs).
    - Use relevant emojis.
    
    IMPORTANT: Return ONLY the text of the post. No extra commentary.
  `;

  return await fetchDeepseek([{ role: "user", content: prompt }]);
};
