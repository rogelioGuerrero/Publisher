import { ArticleLength, Language, SourceRegion } from './types';

export const LENGTHS: { code: ArticleLength; label: string; desc: string }[] = [
    { code: 'short', label: 'Breve', desc: '~300' },
    { code: 'medium', label: 'Estándar', desc: '~600' },
    { code: 'long', label: 'Profundo', desc: '~1000' },
];

export const LANGUAGES: { code: Language; label: string }[] = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'Inglés' },
    { code: 'fr', label: 'Francés' },
];

export const PLACEHOLDERS = [
    "Ej: Startups de IA en Latam...",
    "Ej: Crisis climática y energías renovables...",
    "Ej: Resultados de la Champions League...",
    "Ej: Avances en computación cuántica...",
    "Ej: Tendencias de mercado crypto..."
];

export const MULTILATERAL_DOMAINS = [
    'imf.org',
    'worldbank.org',
    'cepal.org',
    'iadb.org'
];

export const REGION_DOMAIN_MAP: Record<SourceRegion, string[]> = {
    world: [],
    us: [
        'bloomberg.com',
        'wsj.com',
        'reuters.com',
        'nytimes.com',
        'washingtonpost.com',
        'cnbc.com',
        'ft.com'
    ],
    eu: [
        'ec.europa.eu',
        'ecb.europa.eu',
        'politico.eu',
        'ft.com',
        'reuters.com',
        'bbc.co.uk',
        'lesechos.fr',
        'faz.net',
        'ilsole24ore.com',
        'expansion.com',
        'elpais.com',
        'cincodias.elpais.com'
    ],
    latam: [
        'infobae.com',
        'elpais.com/america',
        'eleconomista.com.mx',
        'portafolio.co',
        'gestion.pe',
        'df.cl',
        'latercera.com',
        'valor.globo.com',
        'folha.uol.com.br',
        'banxico.org.mx',
        'bcra.gob.ar',
        'bcb.gov.br',
        'bcrp.gob.pe'
    ],
    asia: []
};

export const getRegionPreferredDomains = (region: SourceRegion) => {
    const regional = REGION_DOMAIN_MAP[region] || [];
    const combined = [...regional, ...MULTILATERAL_DOMAINS];
    return Array.from(new Set(combined));
};
