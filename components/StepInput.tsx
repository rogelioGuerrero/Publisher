import React from 'react';
import { InputMode, UploadedFile, Language, ArticleLength, AdvancedSettings } from '../types';
import { LANGUAGES, LENGTHS } from '../constants';

interface StepInputProps {
    inputMode: InputMode;
    setInputMode: (m: InputMode) => void;
    inputValue: string;
    setInputValue: (v: string) => void;
    placeholderText: string;
    selectedFile: UploadedFile | null;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    selectedLanguage: Language;
    setSelectedLanguage: (l: Language) => void;
    selectedLength: ArticleLength;
    setSelectedLength: (l: ArticleLength) => void;
    showAdvanced: boolean;
    setShowAdvanced: (v: boolean) => void;
    advancedSettings: AdvancedSettings;
    setAdvancedSettings: (s: AdvancedSettings) => void;
    addDomain: (type: 'preferred' | 'blocked', value: string) => void;
    removeDomain: (type: 'preferred' | 'blocked', value: string) => void;
    prefSourceInput: string;
    setPrefSourceInput: (v: string) => void;
    blockedSourceInput: string;
    setBlockedSourceInput: (v: string) => void;
    onStartGeneration: () => void;
}

export const StepInput: React.FC<StepInputProps> = ({
    inputMode,
    setInputMode,
    inputValue,
    setInputValue,
    placeholderText,
    selectedFile,
    fileInputRef,
    handleFileChange,
    selectedLanguage,
    setSelectedLanguage,
    selectedLength,
    setSelectedLength,
    showAdvanced,
    setShowAdvanced,
    advancedSettings,
    setAdvancedSettings,
    addDomain,
    removeDomain,
    prefSourceInput,
    setPrefSourceInput,
    blockedSourceInput,
    setBlockedSourceInput,
    onStartGeneration
}) => {

    const renderChipInput = (
        label: string, 
        placeholder: string, 
        values: string[], 
        currentInput: string,
        setInput: (v: string) => void,
        type: 'preferred' | 'blocked'
    ) => (
      <div className="space-y-2">
          <label className="text-slate-400 font-medium text-xs uppercase tracking-wide">{label}</label>
          <div className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
              {values.map((val, i) => (
                  <span key={i} className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 ${type === 'preferred' ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}>
                      {val}
                      <button onClick={() => removeDomain(type, val)} className="hover:text-white ml-1">×</button>
                  </span>
              ))}
              <input 
                  type="text"
                  className="bg-transparent border-none outline-none text-sm text-white flex-1 min-w-[120px]"
                  placeholder={placeholder}
                  value={currentInput}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                          e.preventDefault();
                          addDomain(type, currentInput);
                      }
                  }}
              />
          </div>
      </div>
    );

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <div className="text-center mb-10">
                <h2 className="text-4xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Redacción Periodística con IA</h2>
                <p className="text-slate-400">Genera artículos profundos, multimedia y multilingües en segundos.</p>
            </div>

            <div className="glass-panel rounded-2xl p-1">
                <div className="flex border-b border-slate-700/50">
                    <button 
                        onClick={() => setInputMode('topic')}
                        className={`flex-1 py-4 text-sm font-medium transition-colors relative ${inputMode === 'topic' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Por Tema
                        {inputMode === 'topic' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>}
                    </button>
                    <button 
                        onClick={() => setInputMode('document')}
                        className={`flex-1 py-4 text-sm font-medium transition-colors relative ${inputMode === 'document' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Desde Documento
                        {inputMode === 'document' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>}
                    </button>
                </div>

                <div className="p-8">
                    {inputMode === 'topic' ? (
                        <div className="mb-8">
                            <label className="block text-slate-300 mb-3 font-medium">¿Sobre qué quieres escribir hoy?</label>
                            <textarea 
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={placeholderText}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-32 resize-none placeholder-slate-600"
                            />
                        </div>
                    ) : (
                        <div className="mb-8">
                            <label className="block text-slate-300 mb-3 font-medium">Sube tu fuente (PDF, TXT, MD)</label>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${selectedFile ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700 hover:border-indigo-500 hover:bg-slate-800/50'}`}
                            >
                                {selectedFile ? (
                                    <div className="text-green-400">
                                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <p className="font-medium">{selectedFile.name}</p>
                                        <p className="text-xs opacity-70">Click para cambiar</p>
                                    </div>
                                ) : (
                                    <div className="text-slate-400">
                                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                        <p>Arrastra un archivo o haz click aquí</p>
                                    </div>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".txt,.md,.csv,.json" />
                        </div>
                    )}

                    {/* BASIC SETTINGS */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-slate-400 text-xs uppercase font-bold mb-2">Idioma</label>
                            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600">
                                {LANGUAGES.map(l => (
                                    <button
                                        key={l.code}
                                        onClick={() => setSelectedLanguage(l.code)}
                                        className={`flex-1 py-2 text-xs rounded-md transition-all font-medium ${selectedLanguage === l.code ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        {l.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-slate-400 text-xs uppercase font-bold mb-2">Longitud</label>
                            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600">
                                {LENGTHS.map(l => (
                                    <button
                                        key={l.code}
                                        onClick={() => setSelectedLength(l.code)}
                                        className={`flex-1 py-2 text-xs rounded-md transition-all font-medium ${selectedLength === l.code ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                        title={l.desc}
                                    >
                                        {l.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ADVANCED TOGGLE */}
                    <div className="border-t border-slate-700/50 pt-4 mb-6">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                            <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                            Configuración Avanzada (Estilo, Fuentes, Tono)
                        </button>
                        
                        {showAdvanced && (
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-slate-400 font-medium text-xs uppercase tracking-wide">Tono Editorial</label>
                                        <select 
                                            value={advancedSettings.tone}
                                            onChange={(e) => setAdvancedSettings({...advancedSettings,tone: e.target.value as any})}
                                            className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                                        >
                                            <option value="objective">Objetivo / Neutral</option>
                                            <option value="editorial">Editorial / Opinión</option>
                                            <option value="corporate">Corporativo / Formal</option>
                                            <option value="narrative">Narrativo / Storytelling</option>
                                            <option value="sensational">Viral / Impacto</option>
                                            <option value="satirical">Satírico / Humor</option>
                                            <option value="explanatory">Educativo / Explicativo</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-slate-400 font-medium text-xs uppercase tracking-wide">Audiencia</label>
                                        <select 
                                            value={advancedSettings.audience}
                                            onChange={(e) => setAdvancedSettings({...advancedSettings,audience: e.target.value as any})}
                                            className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                                        >
                                            <option value="general">Público General</option>
                                            <option value="expert">Expertos / Técnicos</option>
                                            <option value="investor">Inversores / Financiero</option>
                                            <option value="executive">Ejecutivos / Estrategia</option>
                                            <option value="academic">Estudiantes / Académico</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-slate-400 font-medium text-xs uppercase tracking-wide">Estilo Visual</label>
                                        <select 
                                            value={advancedSettings.visualStyle}
                                            onChange={(e) => setAdvancedSettings({...advancedSettings, visualStyle: e.target.value as any})}
                                            className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                                        >
                                            <option value="photorealistic">Fotorealista</option>
                                            <option value="illustration">Ilustración Editorial</option>
                                            <option value="cyberpunk">Cyberpunk / Tech</option>
                                            <option value="minimalist">Minimalista</option>
                                            <option value="data">Infográfico / Data</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {/* Re-added TimeFrame and Region together */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-slate-400 font-medium text-xs uppercase tracking-wide">Región de Fuentes</label>
                                            <select 
                                                value={advancedSettings.sourceRegion}
                                                onChange={(e) => setAdvancedSettings({...advancedSettings, sourceRegion: e.target.value as any})}
                                                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                                            >
                                                <option value="world">Global</option>
                                                <option value="latam">Latinoamérica</option>
                                                <option value="us">Estados Unidos</option>
                                                <option value="eu">Europa</option>
                                                <option value="asia">Asia</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-slate-400 font-medium text-xs uppercase tracking-wide">Temporalidad</label>
                                            <select 
                                                value={advancedSettings.timeFrame}
                                                onChange={(e) => setAdvancedSettings({...advancedSettings, timeFrame: e.target.value as any})}
                                                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                                            >
                                                <option value="any">Cualquier fecha</option>
                                                <option value="24h">Últimas 24h</option>
                                                <option value="week">Esta Semana</option>
                                                <option value="month">Este Mes</option>
                                            </select>
                                        </div>
                                    </div>

                                    {renderChipInput("Fuentes Preferidas", "Ej: BBC, CNN", advancedSettings.preferredDomains, prefSourceInput, setPrefSourceInput, 'preferred')}
                                    {renderChipInput("Fuentes Bloqueadas", "Ej: Wikipedia", advancedSettings.blockedDomains, blockedSourceInput, setBlockedSourceInput, 'blocked')}
                                </div>
                                <div className="col-span-2 border-t border-slate-700/50 pt-4 flex flex-wrap gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={advancedSettings.includeQuotes} onChange={e => setAdvancedSettings({...advancedSettings, includeQuotes: e.target.checked})} className="rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500" />
                                        <span className="text-sm text-slate-300">Citas Directas</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={advancedSettings.includeStats} onChange={e => setAdvancedSettings({...advancedSettings, includeStats: e.target.checked})} className="rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500" />
                                        <span className="text-sm text-slate-300">Datos y Estadísticas</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={advancedSettings.includeCounterArguments} onChange={e => setAdvancedSettings({...advancedSettings, includeCounterArguments: e.target.checked})} className="rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500" />
                                        <span className="text-sm text-slate-300">Contraargumentos</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={advancedSettings.verifiedSourcesOnly} onChange={e => setAdvancedSettings({...advancedSettings, verifiedSourcesOnly: e.target.checked})} className="rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500" />
                                        <span className="text-sm text-slate-300 font-medium text-green-400">Solo Fuentes Verificadas</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={onStartGeneration}
                        disabled={inputMode === 'topic' && !inputValue.trim()}
                        className="btn btn-primary w-full py-4 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {inputMode === 'topic' ? 'Investigar y Redactar' : 'Analizar Documento'}
                    </button>
                </div>
            </div>
        </div>
    );
};
