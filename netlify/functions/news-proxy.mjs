// Netlify Function - Proxy para APIs de Noticias
// Evita problemas de CORS al hacer peticiones desde el navegador

export default async (request, context) => {
  // Configurar CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') || 'gnews';
  
  console.log(`[PROXY] Request: ${request.method} ${url.pathname}`);
  console.log(`[PROXY] Provider: ${provider}`);
  console.log(`[PROXY] Query params:`, Object.fromEntries(url.searchParams.entries()));
  
  try {
    let targetUrl;
    
    if (provider === 'gnews') {
      // Construir URL de GNews
      const apiKey = url.searchParams.get('apikey');
      const query = url.searchParams.get('q') || '';
      const lang = url.searchParams.get('lang') || 'es';
      const max = url.searchParams.get('max') || '10';
      const from = url.searchParams.get('from');
      const expand = url.searchParams.get('expand') || 'content';
      
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'API key requerida' }),
          { status: 400, headers: corsHeaders }
        );
      }
      
      // Endpoint de búsqueda o headlines
      const endpoint = query 
        ? 'https://gnews.io/api/v4/search'
        : 'https://gnews.io/api/v4/top-headlines';
      
      const params = new URLSearchParams();
      params.append('apikey', apiKey);
      params.append('lang', lang);
      params.append('max', max);
      if (expand) params.append('expand', expand);
      if (query) params.append('q', query);
      // Nota: El parámetro 'from' puede causar problemas si la fecha es inválida
      // Lo omitimos por ahora para asegurar que funcione la búsqueda básica
      // if (from) params.append('from', from);
      
      // Región/país
      const country = url.searchParams.get('country');
      if (country) params.append('country', country);
      
      targetUrl = `${endpoint}?${params.toString()}`;
      console.log(`[PROXY] GNews URL: ${targetUrl.replace(apiKey, '***')}`);
      
    } else if (provider === 'apinews') {
      // Construir URL de NewsAPI
      const apiKey = url.searchParams.get('apiKey');
      const query = url.searchParams.get('q') || 'news';
      const language = url.searchParams.get('language') || 'es';
      const pageSize = url.searchParams.get('pageSize') || '10';
      const from = url.searchParams.get('from');
      const sortBy = url.searchParams.get('sortBy') || 'publishedAt';
      
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'API key requerida' }),
          { status: 400, headers: corsHeaders }
        );
      }
      
      const params = new URLSearchParams();
      params.append('apiKey', apiKey);
      params.append('q', query);
      params.append('language', language);
      params.append('pageSize', pageSize);
      params.append('sortBy', sortBy);
      // Omitir 'from' por ahora para evitar errores de fecha
      // if (from) params.append('from', from);
      
      targetUrl = `https://newsapi.org/v2/everything?${params.toString()}`;
      console.log(`[PROXY] APINews URL: ${targetUrl.replace(apiKey, '***')}`);
      
    } else {
      return new Response(
        JSON.stringify({ error: 'Provider no soportado. Use gnews o apinews' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Hacer la petición al API de noticias
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NewsGen-Publisher/1.0'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API externa error: ${response.status}`, targetUrl.replace(apiKey, '***'), errorText.substring(0, 200));
      return new Response(
        JSON.stringify({ 
          error: 'Error desde API externa',
          status: response.status,
          targetUrl: targetUrl.replace(apiKey, '***'),
          details: errorText
        }),
        { status: response.status, headers: corsHeaders }
      );
    }
    
    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      { status: 200, headers: corsHeaders }
    );
    
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del proxy',
        message: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};
