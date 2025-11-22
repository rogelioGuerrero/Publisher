import React from 'react';
import { NewsArticle, SourceGroup } from '../types';

interface StepTextReviewProps {
    article: NewsArticle;
    groupedSources: SourceGroup[];
    onBack: () => void;
    onConfirm: () => void;
}

export const StepTextReview: React.FC<StepTextReviewProps> = ({ article, groupedSources, onBack, onConfirm }) => {
    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <button onClick={onBack} className="text-indigo-400 hover:text-white mb-4 text-sm flex items-center gap-1">← Volver al inicio</button>

            <div className="glass-panel rounded-xl p-8 mb-6">
                <h2 className="text-3xl font-bold mb-6">{article.title}</h2>

                <div className="prose prose-invert prose-indigo max-w-none mb-8">
                    {article.content.split('\n').map((line, i) => (
                        <p key={i} className="text-slate-300 mb-2 leading-relaxed">{line}</p>
                    ))}
                </div>

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
