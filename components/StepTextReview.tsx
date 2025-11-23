import React from 'react';
import { NewsArticle, SourceGroup, RawSourceChunk } from '../types';

interface StepTextReviewProps {
    article: NewsArticle;
    groupedSources: SourceGroup[];
    rawSourceChunks: RawSourceChunk[];
    onBack: () => void;
    onConfirm: () => void;
    onRetryGeneration: () => void;
}

export const StepTextReview: React.FC<StepTextReviewProps> = ({ article, groupedSources, rawSourceChunks, onBack, onConfirm, onRetryGeneration }) => {
    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <button onClick={onBack} className="text-indigo-400 hover:text-white mb-4 text-sm flex items-center gap-1">← Volver al inicio</button>

            <div className="glass-panel rounded-xl p-8 mb-6">
                <h2 className="text-3xl font-bold mb-6">{article.title}</h2>

                <div className="prose prose-invert prose-indigo max-w-none mb-8">
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
                            <p key={i} className="text-slate-300 mb-2 leading-relaxed">
                                {line}
                            </p>
                        );
                    })}
                </div>

                {groupedSources.length === 0 && (
                    <div className="mb-8 border border-amber-400/40 bg-amber-500/10 text-amber-200 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <p className="font-semibold mb-1">Sin fuentes verificadas</p>
                                <p className="text-sm text-amber-100/80">La respuesta del modelo no incluyó enlaces confiables. Puedes reintentar la investigación para intentar obtener citas nuevas o continuar bajo tu responsabilidad.</p>
                                <button 
                                    onClick={onRetryGeneration}
                                    className="mt-3 btn btn-outline text-xs px-3 py-1.5"
                                >
                                    Reintentar investigación
                                </button>
                                {rawSourceChunks.length > 0 ? (
                                    <details className="mt-4 text-xs text-amber-100/80">
                                        <summary className="cursor-pointer underline">Ver grounding chunks devueltos ({rawSourceChunks.length})</summary>
                                        <div className="mt-2 max-h-48 overflow-auto bg-black/20 border border-amber-400/30 rounded-lg p-3 text-[11px] font-mono">
                                            {rawSourceChunks.map((chunk, idx) => (
                                                <div key={idx} className="py-1 border-b border-white/5 last:border-0">
                                                    <div><span className="text-amber-200/80">Título:</span> {chunk.title || '—'}</div>
                                                    <div><span className="text-amber-200/80">URL:</span> {chunk.uri || '—'}</div>
                                                    <div className="opacity-70">{chunk.snippet || 'Sin snippet'}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                ) : (
                                    <p className="mt-4 text-xs text-amber-100/70 italic">(Gemini no envió groundingMetadata; no hay chunks que analizar.)</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {groupedSources.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-700">
                        <h4 className="text-sm font-bold uppercase text-slate-500 mb-4">Fuentes Agrupadas por Dominio</h4>
                        <div className="space-y-3">
                            {groupedSources.map((group) => (
                                <div key={group.domain} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                                    <div className="flex items-center justify-between text-sm font-semibold text-white">
                                        <span>{group.domain}</span>
                                        <span className="text-xs text-slate-400">{group.occurrences} referencia{group.occurrences !== 1 ? 's' : ''}</span>
                                    </div>
                                    <ul className="mt-3 space-y-1 text-xs">
                                        {group.links.map((link, idx) => (
                                            <li key={idx} className="flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block"></span>
                                                <a href={link.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-white truncate">
                                                    {link.title}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end">
                <button 
                    onClick={onConfirm}
                    className="btn btn-secondary py-3 px-8"
                >
                    Aprobar y Generar Multimedia →
                </button>
            </div>
        </div>
    );
};
