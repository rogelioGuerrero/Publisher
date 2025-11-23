import React from 'react';
import { NewsArticle, AdvancedSettings, SourceGroup } from '../types';
import { getMediaSrc } from '../utils';

interface StepCompleteProps {
    article: NewsArticle;
    currentMediaIndex: number;
    videoRefs: React.MutableRefObject<(HTMLVideoElement | null)[]>;
    onPrevMedia: () => void;
    onNextMedia: () => void;
    onEditMedia: () => void;
    onEditText: () => void;
    onModifySearch: () => void;
    onOpenSocial: (platform?: 'x' | 'linkedin' | 'facebook') => void;
    onDownloadJSON: () => void;
    onOpenEmbed: () => void;
    onExportVideo: () => void;
    isExportingVideo: boolean;
    exportStatus: string;
    exportProgress: number;
    advancedSettings: AdvancedSettings;
    onReset: () => void;
    groupedSources: SourceGroup[];
}

export const StepComplete: React.FC<StepCompleteProps> = ({
    article,
    currentMediaIndex,
    videoRefs,
    onPrevMedia,
    onNextMedia,
    onEditMedia,
    onEditText,
    onModifySearch,
    onOpenSocial,
    onDownloadJSON,
    onOpenEmbed,
    onExportVideo,
    isExportingVideo,
    exportStatus,
    exportProgress,
    advancedSettings,
    onReset,
    groupedSources
}) => {
    return (
        <div className="animate-fade-in max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* MAIN CONTENT */}
            <div className="lg:col-span-2 space-y-8">
                {/* MEDIA PLAYER / CAROUSEL */}
                {article.media.length > 0 && (
                    <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl group">
                        {article.media.map((item, idx) => (
                            <div 
                                key={idx}
                                className={`absolute inset-0 transition-opacity duration-700 ${idx === currentMediaIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                            >
                                {item.type === 'video' ? (
                                    <video 
                                        ref={(el) => { videoRefs.current[idx] = el; }}
                                        src={getMediaSrc(item)} 
                                        className="w-full h-full object-cover"
                                        loop
                                        muted
                                        playsInline
                                    />
                                ) : (
                                    <img src={getMediaSrc(item)} className="w-full h-full object-cover" alt="visual" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                            </div>
                        ))}
                        
                        <div className="absolute bottom-0 left-0 p-8 z-20 w-full">
                            <div className="flex gap-2 mb-2">
                                <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">
                                    {article.keywords[0] || "Noticia"}
                                </span>
                                <span className="bg-white/20 backdrop-blur-md text-white text-xs px-2 py-1 rounded font-mono">
                                    {new Date(article.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight drop-shadow-lg">{article.title}</h1>
                        </div>

                        {article.media.length > 1 && (
                            <>
                                <button onClick={onPrevMedia} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur z-30 opacity-0 group-hover:opacity-100 transition-opacity">←</button>
                                <button onClick={onNextMedia} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur z-30 opacity-0 group-hover:opacity-100 transition-opacity">→</button>
                                
                                <div className="absolute bottom-4 right-4 z-30 flex gap-1">
                                    {article.media.map((_, i) => (
                                        <div key={i} className={`h-1 rounded-full transition-all ${i === currentMediaIndex ? 'w-6 bg-white' : 'w-2 bg-white/50'}`} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
                
                {/* AUDIO PLAYER */}
                {article.audioUrl && (
                     <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl flex items-center gap-4">
                        <button className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white flex-shrink-0">▶</button>
                        <div className="flex-1">
                            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full w-1/3 bg-indigo-400"></div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 mt-1">
                                <span>0:00</span>
                                <span>Audio Generado por IA</span>
                            </div>
                        </div>
                        <audio controls className="w-full hidden" src={article.audioUrl}></audio>
                     </div>
                )}

                {/* ARTICLE TEXT */}
                <div className="prose prose-lg prose-invert prose-indigo max-w-none">
                     {article.content.split('\n').map((rawLine, i) => {
                        const line = typeof rawLine === 'string' ? rawLine : String(rawLine ?? '');
                        const trimmed = line.trim();

                        // Caso: subtítulos devueltos como HTML, ej. <h3>Texto</h3>
                        const lower = trimmed.toLowerCase();
                        if (lower.startsWith('<h') && lower.includes('>') && lower.includes('</')) {
                            const openEnd = trimmed.indexOf('>');
                            const closeStart = trimmed.lastIndexOf('</');
                            const inner = openEnd >= 0 && closeStart > openEnd
                                ? trimmed.substring(openEnd + 1, closeStart).trim()
                                : trimmed;

                            return (
                                <h3 key={i} className="text-2xl font-bold text-white mt-8 mb-4">
                                    {inner}
                                </h3>
                            );
                        }

                        // Caso: markdown estilo ### Título
                        if (trimmed.startsWith('###')) {
                            return (
                                <h3 key={i} className="text-2xl font-bold text-white mt-8 mb-4">
                                    {trimmed.replace(/#/g, '').trim()}
                                </h3>
                            );
                        }

                        return (
                            <p key={i} className="text-slate-300 mb-4 leading-relaxed">
                                {line}
                            </p>
                        );
                    })}
                </div>
                {groupedSources.length > 0 && (
                    <div className="mt-4 text-sm text-slate-400">
                        <span className="font-semibold">Fuentes: </span>
                        {groupedSources.map((group, idx) => (
                            <span key={group.domain}>
                                {group.domain}{idx < groupedSources.length - 1 ? '; ' : '.'}
                            </span>
                        ))}
                    </div>
                )}
                
            </div>

            {/* SIDEBAR ACTIONS */}
            <div className="space-y-6">
                <div className="glass-panel p-6 rounded-xl sticky top-24">
                    <h3 className="font-bold text-lg mb-4">Acciones</h3>
                    
                    {/* Navigation / Edit Controls */}
                    <div className="grid grid-cols-2 gap-2 mb-4 pb-4 border-b border-slate-700/50">
                        <button 
                            onClick={onEditMedia}
                            className="btn btn-outline text-sm px-4 py-2"
                            title="Volver a editar imágenes y videos"
                        >
                            ← Media
                        </button>
                        <button 
                            onClick={onEditText}
                            className="btn btn-outline text-sm px-4 py-2"
                            title="Volver a revisar el texto"
                        >
                            ← Texto
                        </button>
                         <button 
                            onClick={onModifySearch}
                            className="col-span-2 btn btn-outline text-sm px-4 py-2"
                            title="Modificar tema y regenerar"
                        >
                            ↺ Modificar Búsqueda (Paso 1)
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        <button onClick={() => onOpenSocial('x')} className="w-full btn btn-primary py-3 px-8">
                            Social Studio AI
                        </button>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={onDownloadJSON} className="btn btn-outline text-sm px-4 py-2">
                                Descargar JSON
                            </button>
                            <button onClick={onOpenEmbed} className="btn btn-outline text-sm px-4 py-2">
                                Embed HTML
                            </button>
                        </div>

                        <button onClick={onExportVideo} disabled={isExportingVideo || !article.audioUrl} className="w-full btn btn-primary py-3 px-8 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isExportingVideo ? 'Preparando audio...' : 'Descargar audio'}
                        </button>

                        {isExportingVideo && (
                            <div className="space-y-2 bg-slate-900 p-3 rounded border border-slate-800">
                                <div className="flex justify-between text-xs text-indigo-300">
                                    <span>{exportStatus}</span>
                                    <span>{exportProgress}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${exportProgress}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-700/50">
                        <h4 className="text-xs uppercase font-bold text-slate-500 mb-3">Detalles de IA</h4>
                        <div className="space-y-2 text-xs text-slate-400">
                            <div className="flex justify-between"><span>Modelo:</span> <span className="text-slate-200">Gemini 2.5 Flash</span></div>
                            <div className="flex justify-between"><span>Estilo:</span> <span className="text-slate-200 capitalize">{advancedSettings.visualStyle}</span></div>
                            <div className="flex justify-between"><span>Tono:</span> <span className="text-slate-200 capitalize">{advancedSettings.tone}</span></div>
                        </div>
                    </div>

                    <button onClick={onReset} className="w-full mt-6 btn btn-outline text-sm px-4 py-2">
                        Crear Nuevo Artículo
                    </button>
                </div>
            </div>
        </div>
    );
};
