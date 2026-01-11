
export interface Message {
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

export enum LoadingState {
    IDLE = 'IDLE',
    LOADING = 'LOADING',
    SUCCESS = 'SUCCESS',
    ERROR = 'ERROR'
}

export interface NewsSource {
    title: string;
    uri: string;
}

export interface RawSourceChunk {
    title?: string | null;
    uri?: string | null;
    snippet?: string | null;
    provider?: string | null;
}

export interface MediaItem {
    type: 'image' | 'video';
    data: string; // Base64 or URL
    mimeType: string;
}

export interface ChartData {
    title: string;
    labels: string[];
    values: number[];
    unit?: string;
}

export interface NewsArticle {
    id: string; // Unique ID for history
    createdAt: number;
    topic: string;
    title: string;
    content: string;
    sources: NewsSource[];
    rawSources?: RawSourceChunk[];
    media: MediaItem[]; 
    audioUrl?: string;
    language: Language;
    // SEO Metadata
    keywords: string[];
    metaDescription: string;
    // Generation prompt for consistency
    imagePrompt: string;
    chartData?: ChartData;
}

export enum GenerationStep {
    INPUT = 0,
    TEXT_SEARCH = 1,
    TEXT_REVIEW = 2, // Review text before generating media
    MEDIA_REVIEW = 3, // Review/upload media
    COMPLETE = 4
}

export type InputMode = 'topic' | 'document';

export type Language = 'es' | 'en' | 'fr' | 'pt' | 'de';

export type ArticleLength = 'short' | 'medium' | 'long';

// --- NEW ADVANCED SETTINGS TYPES ---

export type ArticleTone = 'objective' | 'editorial' | 'corporate' | 'narrative' | 'satirical' | 'sensational' | 'explanatory';

export type ArticleAudience = 'general' | 'expert' | 'investor' | 'executive' | 'academic';

export type ArticleFocus = 'general' | 'economic' | 'political' | 'social' | 'technological';

export type TimeFrame = '24h' | 'week' | 'month' | 'any';

export type VisualStyle = 'photorealistic' | 'illustration' | 'cyberpunk' | 'minimalist' | 'data';

export type SourceRegion = 'world' | 'us' | 'eu' | 'latam' | 'asia';

export interface AdvancedSettings {
    tone: ArticleTone;
    audience: ArticleAudience;
    focus: ArticleFocus; 
    timeFrame: TimeFrame;
    visualStyle: VisualStyle;
    
    // Source Control
    sourceRegion: SourceRegion;
    preferredDomains: string[]; // Chips
    blockedDomains: string[];   // Chips
    verifiedSourcesOnly: boolean;

    // Credibility Elements
    includeQuotes: boolean; 
    includeStats: boolean; 
    includeCounterArguments: boolean; 
}

export interface UploadedFile {
    data: string; // Base64
    mimeType: string;
    name: string;
}

export interface SourceGroup {
    domain: string;
    occurrences: number;
    links: { title: string; uri: string }[];
}

export type AIProvider = 'gemini' | 'deepseek';

export type ImageModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview' | 'imagen-3-fast-generate-001';

export interface ProjectConfig {
    activeProvider: AIProvider;
    geminiApiKey: string;
    deepseekApiKey: string;
    pexelsApiKey: string;
    preferredDomains: string[];
    blockedDomains: string[];
    imageModel: ImageModel;
}

declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
}