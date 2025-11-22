import React from 'react';
import { NewsArticle } from '../types';
import { getMediaSrc } from '../utils';

interface StepMediaReviewProps {
    article: NewsArticle;
    onBack: () => void;
    pexelsQueryInput: string;
    setPexelsQueryInput: (v: string) => void;
    isSearchingPexels: boolean;
    onSearchPexels: () => void;
    isGeneratingImages: boolean;
    onRegenerateImages: () => void;
    onRemoveMedia: (index: number) => void;
    handleDragStart: (e: React.DragEvent<HTMLDivElement>, position: number) => void;
    handleDragEnter: (e: React.DragEvent<HTMLDivElement>, position: number) => void;
    handleSort: () => void;
    mediaUploadRef: React.RefObject<HTMLInputElement>;
    handleUserMediaUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    mediaUrlInput: string;
    setMediaUrlInput: (v: string) => void;
    handleAddUrlMedia: () => void;
    includeAudio: boolean;
    setIncludeAudio: (v: boolean) => void;
    onFinalize: () => void;
}

export const StepMediaReview: React.FC<StepMediaReviewProps> = ({
    article,
    onBack,
    pexelsQueryInput,
    setPexelsQueryInput,
    isSearchingPexels,
    onSearchPexels,
    isGeneratingImages,
    onRegenerateImages,
    onRemoveMedia,
    handleDragStart,
    handleDragEnter,
    handleSort,
    mediaUploadRef,
    handleUserMediaUpload,
    mediaUrlInput,
    setMediaUrlInput,
    handleAddUrlMedia,
    includeAudio,
    setIncludeAudio,
    onFinalize
}) => {
    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <button onClick={onBack} className="btn btn-outline text-sm px-4 py-2">← Volver al texto</button>
                <h2 className="text-2xl font-bold">Curaduría Multimedia</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <h4 className="text-sm font-bold mb-2 text-indigo-400">Buscar en Pexels (Stock)</h4>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={pexelsQueryInput}
                            onChange={(e) => setPexelsQueryInput(e.target.value)}
                            placeholder="Ej: Oficina moderna..."
                            className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm flex-1"
                        />
                        <button onClick={onSearchPexels} disabled={isSearchingPexels} className="btn btn-outline text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSearchingPexels ? '...' : 'Buscar'}
                        </button>
                    </div>
                </div>

                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold mb-1 text-purple-400">Generar Imagen IA</h4>
                        <p className="text-xs text-slate-400">Crea una ilustración única</p>
                    </div>
                    <button onClick={onRegenerateImages} disabled={isGeneratingImages} className="btn btn-primary text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isGeneratingImages ? 'Generando...' : 'Generar'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {article.media.map((item, idx) => (
                    <div 
                        key={idx}
                        className="relative group aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-700 cursor-move"
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragEnter={(e) => handleDragEnter(e, idx)}
                        onDragEnd={handleSort}
                        onDragOver={(e) => e.preventDefault()}
                    >
                        {item.type === 'video' ? (
                            <video src={getMediaSrc(item)} className="w-full h-full object-cover" />
                        ) : (
                            <img src={getMediaSrc(item)} className="w-full h-full object-cover" alt="media" />
                        )}
                        <button 
                            onClick={() => onRemoveMedia(idx)}
                            className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                        >
                            ✕
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded text-[10px] text-white uppercase">
                            {item.type}
                        </div>
                    </div>
                ))}

                <label className="aspect-video border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <span className="text-2xl mb-1">+</span>
                    <span className="text-xs">Subir</span>
                    <input ref={mediaUploadRef} type="file" className="hidden" onChange={handleUserMediaUpload} accept="image/*,video/*" />
                </label>
            </div>

            <div className="mb-8 flex gap-2">
                <input 
                    type="text" 
                    value={mediaUrlInput}
                    onChange={(e) => setMediaUrlInput(e.target.value)}
                    placeholder="Pegar URL de imagen o video..."
                    className="bg-transparent border-b border-slate-700 flex-1 py-2 px-1 focus:border-indigo-500 outline-none"
                />
                <button onClick={handleAddUrlMedia} className="btn btn-outline text-sm px-4 py-2">Añadir URL</button>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-8 flex items-center justify-between">
                 <div>
                    <h4 className="font-medium text-white">Narración de Audio (TTS)</h4>
                    <p className="text-xs text-slate-400">Si el switch está activo, generaremos la voz automáticamente al publicar el artículo.</p>
                 </div>
                 <div className="flex items-center gap-4">
                     <label className="toggle-switch cursor-pointer">
                        <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} className="toggle-input" />
                        <span className="toggle-track">
                            <span className="toggle-thumb"></span>
                        </span>
                    </label>
                </div>
            </div>

            <button 
                onClick={onFinalize}
                className="btn btn-success w-full py-4"
            >
                Publicar Artículo Final
            </button>
        </div>
    );
};
