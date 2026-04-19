
import { NewsArticleData, NewsApiProvider, NewsSearchParams, SourceRegion } from "../types";

let gnewsApiKey = import.meta.env.VITE_GNEWS_API_KEY || "";
let apinewsApiKey = import.meta.env.VITE_APINEWS_API_KEY || "";

export const setGNewsApiKey = (key: string) => {
  gnewsApiKey = key;
};

export const setApiNewsApiKey = (key: string) => {
  apinewsApiKey = key;
};

const requireGNewsKey = () => {
  if (!gnewsApiKey) {
    throw new Error("GNews API Key no configurada. Añade tu clave en Configuración del Proyecto.");
  }
  return gnewsApiKey;
};

const requireApiNewsKey = () => {
  if (!apinewsApiKey) {
    throw new Error("APINews API Key no configurada. Añade tu clave en Configuración del Proyecto.");
  }
  return apinewsApiKey;
};

// Helper para calcular fecha de ayer en formato ISO
const getYesterdayDate = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
};

// Helper para calcular fecha según timeframe
const getFromDate = (timeFrame: string): string => {
  const now = new Date();
  switch (timeFrame) {
    case '24h':
      now.setDate(now.getDate() - 1);
      break;
    case 'week':
      now.setDate(now.getDate() - 7);
      break;
    case 'month':
      now.setMonth(now.getMonth() - 1);
      break;
    default:
      now.setDate(now.getDate() - 7); // Default a una semana
  }
  return now.toISOString().split('T')[0];
};

// Map de códigos de idioma para GNews
const LANGUAGE_MAP: Record<string, string> = {
  'es': 'es',
  'en': 'en',
  'fr': 'fr',
  'pt': 'pt',
  'de': 'de'
};

// Map de códigos de país para GNews según región
const REGION_COUNTRY_MAP: Record<string, string[]> = {
  'world': [],
  'us': ['us'],
  'eu': ['gb', 'de', 'fr', 'it', 'es'],
  'latam': ['mx', 'ar', 'br', 'co', 'cl', 'pe'],
  'asia': ['jp', 'cn', 'kr', 'in', 'sg']
};

/**
 * Busca noticias en GNews API
 * https://gnews.io/docs/
 */
export const searchGNews = async (params: NewsSearchParams): Promise<NewsArticleData[]> => {
  try {
    const key = requireGNewsKey();
    const { 
      query, 
      language = 'es', 
      region = 'world',
      timeFrame = 'any',
      maxResults = 10,
      category
    } = params;

    // Construir URL base
    let url: string;
    const searchParams = new URLSearchParams();
    searchParams.append('apikey', key);
    searchParams.append('max', maxResults.toString());

    if (query) {
      // Búsqueda por tema
      url = 'https://gnews.io/api/v4/search';
      searchParams.append('q', query);
    } else {
      // Top headlines
      url = 'https://gnews.io/api/v4/top-headlines';
      if (category) {
        searchParams.append('category', category);
      }
    }

    // Idioma
    const langCode = LANGUAGE_MAP[language] || 'es';
    searchParams.append('lang', langCode);

    // País/Región
    const countries = REGION_COUNTRY_MAP[region];
    if (countries && countries.length > 0) {
      // GNews solo permite un país, usamos el primero o hacemos múltiples requests
      searchParams.append('country', countries[0]);
    }

    // Fecha desde (para filtrar)
    if (timeFrame !== 'any') {
      const fromDate = getFromDate(timeFrame);
      searchParams.append('from', fromDate);
    }

    // Expandir contenido para obtener más texto
    searchParams.append('expand', 'content');

    const fullUrl = `${url}?${searchParams.toString()}`;
    
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.errors?.[0] || `GNews API error: ${response.status}`);
    }

    const data = await response.json();
    
    return (data.articles || []).map((article: any) => ({
      title: article.title || '',
      description: article.description || '',
      content: article.content || article.description || '',
      url: article.url || '',
      imageUrl: article.image || null,
      publishedAt: article.publishedAt || '',
      source: {
        name: article.source?.name || 'Unknown',
        url: article.source?.url || ''
      },
      provider: 'gnews' as NewsApiProvider
    }));

  } catch (error) {
    console.error("GNews API Error:", error);
    throw error instanceof Error ? error : new Error('Error usando la GNews API');
  }
};

/**
 * Obtiene top headlines de GNews
 */
export const getGNewsHeadlines = async (
  language: string = 'es',
  region: SourceRegion = 'world',
  category?: string,
  maxResults: number = 10
): Promise<NewsArticleData[]> => {
  return searchGNews({
    language,
    region,
    category,
    maxResults,
    timeFrame: '24h'
  });
};

/**
 * Busca noticias de ayer en GNews
 */
export const getGNewsFromYesterday = async (
  query?: string,
  language: string = 'es',
  region: SourceRegion = 'world',
  maxResults: number = 10
): Promise<NewsArticleData[]> => {
  const yesterday = getYesterdayDate();
  
  try {
    const key = requireGNewsKey();
    const searchParams = new URLSearchParams();
    searchParams.append('apikey', key);
    searchParams.append('max', maxResults.toString());
    searchParams.append('lang', LANGUAGE_MAP[language] || 'es');
    searchParams.append('from', yesterday);
    searchParams.append('to', yesterday);
    searchParams.append('expand', 'content');

    if (query) {
      searchParams.append('q', query);
    }

    const countries = REGION_COUNTRY_MAP[region];
    if (countries && countries.length > 0) {
      searchParams.append('country', countries[0]);
    }

    const url = query 
      ? `https://gnews.io/api/v4/search?${searchParams.toString()}`
      : `https://gnews.io/api/v4/top-headlines?${searchParams.toString()}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.errors?.[0] || `GNews API error: ${response.status}`);
    }

    const data = await response.json();
    
    return (data.articles || []).map((article: any) => ({
      title: article.title || '',
      description: article.description || '',
      content: article.content || article.description || '',
      url: article.url || '',
      imageUrl: article.image || null,
      publishedAt: article.publishedAt || '',
      source: {
        name: article.source?.name || 'Unknown',
        url: article.source?.url || ''
      },
      provider: 'gnews' as NewsApiProvider
    }));

  } catch (error) {
    console.error("GNews Yesterday Error:", error);
    throw error instanceof Error ? error : new Error('Error obteniendo noticias de ayer');
  }
};

/**
 * Busca noticias en APINews (NewsAPI alternative)
 * https://apinews.io/
 */
export const searchApiNews = async (params: NewsSearchParams): Promise<NewsArticleData[]> => {
  try {
    const key = requireApiNewsKey();
    const { 
      query, 
      language = 'es', 
      region = 'world',
      timeFrame = 'any',
      maxResults = 10
    } = params;

    const searchParams = new URLSearchParams();
    searchParams.append('apiKey', key);
    
    if (query) {
      searchParams.append('q', query);
    } else {
      // Si no hay query, buscar noticias generales
      searchParams.append('q', 'news');
    }

    searchParams.append('language', LANGUAGE_MAP[language] || 'es');
    searchParams.append('pageSize', maxResults.toString());

    // País
    const countries = REGION_COUNTRY_MAP[region];
    if (countries && countries.length > 0) {
      searchParams.append('country', countries[0]);
    }

    // Fecha
    if (timeFrame !== 'any') {
      const fromDate = getFromDate(timeFrame);
      searchParams.append('from', fromDate);
    }

    // Ordenar por relevancia y fecha
    searchParams.append('sortBy', 'publishedAt');

    const url = `https://newsapi.org/v2/everything?${searchParams.toString()}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `APINews API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || 'Error en APINews API');
    }

    return (data.articles || []).map((article: any) => ({
      title: article.title || '',
      description: article.description || '',
      content: article.content || article.description || '',
      url: article.url || '',
      imageUrl: article.urlToImage || null,
      publishedAt: article.publishedAt || '',
      source: {
        name: article.source?.name || 'Unknown',
        url: ''
      },
      provider: 'apinews' as NewsApiProvider
    }));

  } catch (error) {
    console.error("APINews API Error:", error);
    throw error instanceof Error ? error : new Error('Error usando la APINews API');
  }
};

/**
 * Función unificada para buscar noticias en múltiples fuentes
 * Intenta GNews primero, luego APINews como fallback
 */
export const searchNews = async (
  params: NewsSearchParams,
  preferredProvider: NewsApiProvider = 'gnews'
): Promise<{ articles: NewsArticleData[]; provider: NewsApiProvider; usedFallback: boolean }> => {
  const errors: string[] = [];
  
  // Intentar proveedor preferido primero
  if (preferredProvider === 'gnews' && gnewsApiKey) {
    try {
      const articles = await searchGNews(params);
      return { articles, provider: 'gnews', usedFallback: false };
    } catch (e) {
      errors.push(`GNews: ${e instanceof Error ? e.message : 'Error'}`);
    }
  }
  
  if (preferredProvider === 'apinews' && apinewsApiKey) {
    try {
      const articles = await searchApiNews(params);
      return { articles, provider: 'apinews', usedFallback: false };
    } catch (e) {
      errors.push(`APINews: ${e instanceof Error ? e.message : 'Error'}`);
    }
  }

  // Fallback al otro proveedor si está disponible
  if (preferredProvider !== 'gnews' && gnewsApiKey) {
    try {
      const articles = await searchGNews(params);
      return { articles, provider: 'gnews', usedFallback: true };
    } catch (e) {
      errors.push(`GNews (fallback): ${e instanceof Error ? e.message : 'Error'}`);
    }
  }

  if (preferredProvider !== 'apinews' && apinewsApiKey) {
    try {
      const articles = await searchApiNews(params);
      return { articles, provider: 'apinews', usedFallback: true };
    } catch (e) {
      errors.push(`APINews (fallback): ${e instanceof Error ? e.message : 'Error'}`);
    }
  }

  // Si llegamos aquí, ninguna API funcionó
  throw new Error(`No se pudieron obtener noticias. Errores: ${errors.join('; ')}`);
};

/**
 * Obtiene headlines del día o de ayer
 */
export const getHeadlines = async (
  params: Omit<NewsSearchParams, 'query'>,
  preferredProvider: NewsApiProvider = 'gnews'
): Promise<{ articles: NewsArticleData[]; provider: NewsApiProvider; usedFallback: boolean }> => {
  return searchNews({ ...params, query: '' }, preferredProvider);
};
