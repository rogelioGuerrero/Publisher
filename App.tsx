
import React, { useState, useRef, useEffect } from 'react';
import { generateNewsContent, generateNewsImages, generateNewsAudio } from './services/geminiService';
import { GenerationStep, NewsArticle, InputMode, UploadedFile, Language, ArticleLength, AdvancedSettings, MediaItem } from './types';
import { CodeBlock } from './components/CodeBlock';

// --- HELPER: Handle Media Source (Base64 vs URL) ---
const getMediaSrc = (item: MediaItem) => {
  if (item.data.startsWith('http') || item.data.startsWith('https') || item.data.startsWith('//')) {
    return item.data;
  }
  return `data:${item.mimeType};base64,${item.data}`;
};

// --- CONSTANTS ---

const LANGUAGES: { code: Language; label: string }[] = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'pt', label: 'Português' },
    { code: 'de', label: 'Deutsch' },
];

const LENGTHS: { code: ArticleLength; label: string; desc: string }[] = [
    { code: 'short', label: 'Breve', desc: '~300' },
    { code: 'medium', label: 'Estándar', desc: '~600' },
    { code: 'long', label: 'Profundo', desc: '~1000' },
];

const PLACEHOLDERS = [
    "Ej: Startups de IA en Latam...",
    "Ej: Crisis climática y energías renovables...",
    "Ej: Resultados de la Champions League...",
    "Ej: Avances en computación cuántica...",
    "Ej: Tendencias de mercado crypto..."
];

export const App: React.FC = () => {
  // --- STATE ---
  const [inputMode, setInputMode] = useState<InputMode>('topic');
  const [inputValue, setInputValue] = useState('');
  const [placeholderText, setPlaceholderText] = useState(PLACEHOLDERS[0]);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('es');
  const [selectedLength, setSelectedLength] = useState<ArticleLength>('medium');
  
  // Advanced Settings State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>({
    tone: 'objective',
    audience: 'general',
    timeFrame: 'any',
    visualStyle: 'photorealistic',
    sourceRegion: 'world',
    preferredDomains: [],
    blockedDomains: [],
    verifiedSourcesOnly: false
  });
  
  // Temp state for Chip Inputs
  const [prefSourceInput, setPrefSourceInput] = useState('');
  const [blockedSourceInput, setBlockedSourceInput] = useState('');

  // Media URL Input State
  const [mediaUrlInput, setMediaUrlInput] = useState('');

  const [currentStep, setCurrentStep] = useState<GenerationStep>(GenerationStep.INPUT);
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  
  // Carousel
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // History
  const [history, setHistory] = useState<NewsArticle[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaUploadRef = useRef<HTMLInputElement>(null);

  // --- EFFECTS ---

  // Load history
  useEffect(() => {
    const saved = localStorage.getItem('newsgen_history');
    if (saved) {
        try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  // Dynamic Placeholder Typewriter/Rotator
  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
        idx = (idx + 1) % PLACEHOLDERS.length;
        setPlaceholderText(PLACEHOLDERS[idx]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-rotate carousel & Video Playback Control
  useEffect(() => {
    if (currentStep !== GenerationStep.COMPLETE || !article?.media || article.media.length === 0) return;
    
    // 1. Handle Video Playback for current item
    videoRefs.current.forEach((vid, idx) => {
        if (vid && idx !== currentMediaIndex) {
            vid.pause(); // Stop others
            vid.currentTime = 0; // Reset position
        }
    });

    const currentItem = article.media[currentMediaIndex];
    
    if (currentItem.type === 'video') {
        // Play current video
        const vid = videoRefs.current[currentMediaIndex];
        if (vid) {
            vid.play().catch(e => console.log("Autoplay prevented by browser policy (ensure muted):", e));
        }
        // No interval for videos, we rely on onEnded
        return; 
    }

    // 2. If it's an image, rotate after 5 seconds
    const interval = setInterval(() => {
      setCurrentMediaIndex((prev) => (prev + 1) % article.media.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [currentStep, article, currentMediaIndex]);

  // --- HANDLERS ---

  const handleOpenKeySettings = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
    }
  };

  const handleReset = () => {
    setInputValue('');
    setSelectedFile(null);
    setCurrentStep(GenerationStep.INPUT);
    setArticle(null);
    setError(null);
    setCurrentMediaIndex(0);
    setIsGeneratingImages(false);
    setIsFinalizing(false);
    setMediaUrlInput('');
  };

  const handleBackToText = () => {
    setCurrentStep(GenerationStep.TEXT_REVIEW);
    setError(null);
  };

  const handleBackToMedia = () => {
    setCurrentStep(GenerationStep.MEDIA_REVIEW);
    setError(null);
  };

  const handleLoadFromHistory = (savedArticle: NewsArticle) => {
    setArticle(savedArticle);
    setCurrentStep(GenerationStep.COMPLETE);
    setShowHistory(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
        setError("El archivo es demasiado grande (Máx 4MB)");
        return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
        const base64 = (evt.target?.result as string).split(',')[1];
        setSelectedFile({ data: base64, mimeType: file.type, name: file.name });
        setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Chip Input Handlers
  const addDomain = (type: 'preferred' | 'blocked', value: string) => {
      if (!value.trim()) return;
      if (type === 'preferred') {
          if (!advancedSettings.preferredDomains.includes(value)) {
              setAdvancedSettings(prev => ({ ...prev, preferredDomains: [...prev.preferredDomains, value] }));
          }
          setPrefSourceInput('');
      } else {
          if (!advancedSettings.blockedDomains.includes(value)) {
              setAdvancedSettings(prev => ({ ...prev, blockedDomains: [...prev.blockedDomains, value] }));
          }
          setBlockedSourceInput('');
      }
  };

  const removeDomain = (type: 'preferred' | 'blocked', value: string) => {
      if (type === 'preferred') {
          setAdvancedSettings(prev => ({ ...prev, preferredDomains: prev.preferredDomains.filter(d => d !== value) }));
      } else {
          setAdvancedSettings(prev => ({ ...prev, blockedDomains: prev.blockedDomains.filter(d => d !== value) }));
      }
  };

  // STEP 1 -> STEP 2 (Text Generation)
  const startGeneration = async () => {
    if (inputMode === 'topic' && !inputValue.trim()) return;
    if (inputMode === 'document' && !selectedFile) return;

    setError(null);
    setCurrentStep(GenerationStep.TEXT_SEARCH);
    setStatusMessage("Investigando fuentes y redactando...");

    try {
      // 1. Generate Text
      const textData = await generateNewsContent(
          inputValue, inputMode, selectedFile, selectedLanguage, selectedLength, advancedSettings
      );
      
      // Setup Article Object (No Media Yet)
      const partialArticle: NewsArticle = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        topic: inputMode === 'topic' ? inputValue : selectedFile?.name || 'Documento',
        title: textData.title,
        content: textData.content,
        sources: textData.sources,
        media: [],
        language: selectedLanguage,
        keywords: textData.keywords,
        metaDescription: textData.metaDescription,
        imagePrompt: textData.imagePrompt
      };
      setArticle(partialArticle);
      
      // Move to Text Review Step
      setCurrentStep(GenerationStep.TEXT_REVIEW);

    } catch (err) {
      console.error(err);
      setError("Ocurrió un error inesperado. Verifica tu API Key.");
      setCurrentStep(GenerationStep.INPUT);
    }
  };

  // STEP 2 -> STEP 3 (Confirm Text & Generate Images)
  const handleConfirmText = async () => {
      if (!article) return;
      
      setCurrentStep(GenerationStep.MEDIA_REVIEW);
      
      // If we already have media, don't regenerate automatically unless forced
      if (article.media.length > 0) return;

      setIsGeneratingImages(true);
      try {
        const imageBytes = await generateNewsImages(article.imagePrompt);
        const initialMedia: MediaItem[] = imageBytes.map(b => ({
            type: 'image',
            data: b,
            mimeType: 'image/jpeg'
        }));
        setArticle(prev => prev ? { ...prev, media: initialMedia } : null);
      } catch (e) {
          console.error("Error generating images:", e);
          // Non-blocking error, user can add own media
      } finally {
          setIsGeneratingImages(false);
      }
  };

  // STEP 3 Actions
  const handleRegenerateImages = async () => {
      if (!article) return;
      setIsGeneratingImages(true);
      try {
          const prompt = `Editorial illustration for news about: ${article.title}. Style: ${advancedSettings.visualStyle}`;
          const newImages = await generateNewsImages(prompt);
          const newMediaItems: MediaItem[] = newImages.map(b => ({
              type: 'image',
              data: b,
              mimeType: 'image/jpeg'
          }));
          // Append or replace? Let's append for variety
          setArticle(prev => prev ? { ...prev, media: [...prev.media, ...newMediaItems] } : null);
      } catch (e) {
          setError("Error regenerando imágenes.");
      } finally {
          setIsGeneratingImages(false);
      }
  };

  const handleUserMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !article) return;
      
      if (file.size > 10 * 1024 * 1024) {
          setError("El archivo es muy grande (Máx 10MB)");
          return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
          const base64 = (evt.target?.result as string).split(',')[1];
          const isVideo = file.type.startsWith('video/');
          const newItem: MediaItem = {
              type: isVideo ? 'video' : 'image',
              data: base64,
              mimeType: file.type
          };
          setArticle(prev => prev ? { ...prev, media: [...prev.media, newItem] } : null);
      };
      reader.readAsDataURL(file);
      if (mediaUploadRef.current) mediaUploadRef.current.value = '';
  };

  const handleAddUrlMedia = () => {
    if (!mediaUrlInput.trim()) return;
    const url = mediaUrlInput.trim();
    // Simple detection logic
    const isVideo = /\.(mp4|webm|ogg|mov)|pexel/i.test(url) || url.includes('video');
    
    const newItem: MediaItem = {
        type: isVideo ? 'video' : 'image',
        data: url,
        mimeType: isVideo ? 'video/mp4' : 'image/jpeg' // Fallbacks
    };
    
    setArticle(prev => prev ? { ...prev, media: [...prev.media, newItem] } : null);
    setMediaUrlInput('');
  };

  const handleRemoveMedia = (index: number) => {
      if (!article) return;
      const newMedia = article.media.filter((_, i) => i !== index);
      setArticle({ ...article, media: newMedia });
  };

  // STEP 3 -> STEP 4 (Finalize)
  const finalizeArticle = async () => {
      if (!article) return;
      setIsFinalizing(true);
      
      try {
          let audioUrl = article.audioUrl;
          
          // Generate audio if missing (or if text was edited)
          if (!audioUrl) {
            setStatusMessage("Sintetizando voz humana...");
            audioUrl = await generateNewsAudio(article.content, selectedLanguage);
          } else {
            setStatusMessage("Publicando...");
            await new Promise(resolve => setTimeout(resolve, 800));
          }

          const finalArticle = { ...article, audioUrl };
          
          setArticle(finalArticle);
          setCurrentStep(GenerationStep.COMPLETE);
          
          const newHistory = [finalArticle, ...history].slice(0, 10);
          setHistory(newHistory);
          localStorage.setItem('newsgen_history', JSON.stringify(newHistory));
      } catch (e) {
          setError("Error generando audio. El artículo se mostrará sin voz.");
          setCurrentStep(GenerationStep.COMPLETE);
      } finally {
          setIsFinalizing(false);
      }
  };


  const nextMedia = () => {
    if (!article?.media.length) return;
    setCurrentMediaIndex((prev) => (prev + 1) % article.media.length);
  };

  const prevMedia = () => {
    if (!article?.media.length) return;
    setCurrentMediaIndex((prev) => (prev - 1 + article.media.length) % article.media.length);
  };

  // --- UI COMPONENTS ---

  const renderChipInput = (
      label: string, 
      placeholder: string, 
      values: string[], 
      inputValue: string,
      setInputValue: (v: string) => void,
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
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addDomain(type, inputValue);
                    }
                }}
                placeholder={values.length === 0 ? placeholder : ''}
                className="bg-transparent border-none outline-none text-slate-200 text-sm flex-1 min-w-[120px]"
            />
        </div>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-6 mt-4 text-sm animate-fade-in-down shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            
            {/* Column 1: Style & Tone */}
            <div className="space-y-4">
                <h4 className="text-indigo-400 font-bold uppercase text-xs tracking-widest border-b border-indigo-500/20 pb-2 mb-2">Estilo y Audiencia</h4>
                <div className="space-y-2">
                    <label className="text-slate-400 font-medium">Tono Editorial</label>
                    <select 
                        value={advancedSettings.tone}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, tone: e.target.value as any})}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="objective">Objetivo / Neutral</option>
                        <option value="editorial">Editorial / Opinión</option>
                        <option value="satirical">Satírico / Humor</option>
                        <option value="sensational">Sensacionalista</option>
                        <option value="explanatory">Educativo / Explicativo</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-slate-400 font-medium">Audiencia</label>
                    <select 
                        value={advancedSettings.audience}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, audience: e.target.value as any})}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="general">Público General</option>
                        <option value="expert">Expertos Técnicos</option>
                        <option value="investor">Inversores</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-slate-400 font-medium">Estilo Visual</label>
                    <select 
                        value={advancedSettings.visualStyle}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, visualStyle: e.target.value as any})}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="photorealistic">Fotorealista</option>
                        <option value="illustration">Ilustración</option>
                        <option value="minimalist">Minimalista</option>
                        <option value="cyberpunk">Cyberpunk</option>
                        <option value="data">Data Viz</option>
                    </select>
                </div>
            </div>

            {/* Column 2: Sources & Control */}
            <div className={`space-y-4 ${inputMode === 'document' ? 'opacity-50 pointer-events-none' : ''}`}>
                <h4 className="text-emerald-400 font-bold uppercase text-xs tracking-widest border-b border-emerald-500/20 pb-2 mb-2">Fuentes y Origen</h4>
                
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-slate-400 font-medium">Región</label>
                        <select 
                            value={advancedSettings.sourceRegion}
                            onChange={(e) => setAdvancedSettings({...advancedSettings, sourceRegion: e.target.value as any})}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="world">Global 🌍</option>
                            <option value="us">EE.UU. 🇺🇸</option>
                            <option value="eu">Europa 🇪🇺</option>
                            <option value="latam">Latam 🌎</option>
                            <option value="asia">Asia 🌏</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                         <label className="text-slate-400 font-medium">Temporalidad</label>
                         <select 
                            value={advancedSettings.timeFrame}
                            onChange={(e) => setAdvancedSettings({...advancedSettings, timeFrame: e.target.value as any})}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="any">Histórico</option>
                            <option value="24h">24 Horas</option>
                            <option value="week">Semana</option>
                            <option value="month">Mes</option>
                        </select>
                    </div>
                </div>

                {renderChipInput(
                    "Fuentes Preferidas (Dominios)", 
                    "Ej: nasa.gov (Enter)", 
                    advancedSettings.preferredDomains, 
                    prefSourceInput, 
                    setPrefSourceInput, 
                    'preferred'
                )}
                
                {renderChipInput(
                    "Bloquear Fuentes", 
                    "Ej: reddit.com (Enter)", 
                    advancedSettings.blockedDomains, 
                    blockedSourceInput, 
                    setBlockedSourceInput, 
                    'blocked'
                )}

                <div className="flex items-center gap-3 pt-2">
                     <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input 
                            type="checkbox" 
                            name="toggle" 
                            id="verified-toggle" 
                            checked={advancedSettings.verifiedSourcesOnly}
                            onChange={(e) => setAdvancedSettings({...advancedSettings, verifiedSourcesOnly: e.target.checked})}
                            className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-emerald-500 right-5"
                        />
                        <label htmlFor="verified-toggle" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${advancedSettings.verifiedSourcesOnly ? 'bg-emerald-500' : 'bg-slate-700'}`}></label>
                    </div>
                    <label htmlFor="verified-toggle" className="text-xs text-slate-300 cursor-pointer select-none">Solo Fuentes Verificadas</label>
                </div>
            </div>
        </div>
        <style>{`
            .toggle-checkbox:checked { right: 0; border-color: #10b981; }
            .toggle-checkbox:checked + .toggle-label { background-color: #10b981; }
            .toggle-checkbox { right: 50%; transition: all 0.3s; }
        `}</style>
    </div>
  );

  const renderStepper = () => {
    const steps = [
      { id: GenerationStep.INPUT, label: "Entrada" },
      { id: GenerationStep.TEXT_SEARCH, label: "Redacción" }, // Merged Text Gen + Text Review visually
      { id: GenerationStep.TEXT_REVIEW, label: "Revisión" }, // Explicit step for reviewing text
      { id: GenerationStep.MEDIA_REVIEW, label: "Multimedia" },
      { id: GenerationStep.COMPLETE, label: "Publicado" },
    ];

    // Simplify visual steps (combine search+review)
    const visualSteps = [
        { id: GenerationStep.INPUT, label: "Entrada", activeOn: [GenerationStep.INPUT] },
        { id: GenerationStep.TEXT_REVIEW, label: "Redacción", activeOn: [GenerationStep.TEXT_SEARCH, GenerationStep.TEXT_REVIEW] },
        { id: GenerationStep.MEDIA_REVIEW, label: "Multimedia", activeOn: [GenerationStep.MEDIA_REVIEW] },
        { id: GenerationStep.COMPLETE, label: "Publicado", activeOn: [GenerationStep.COMPLETE] }
    ];

    return (
      <div className="flex items-center justify-between w-full max-w-xl mx-auto mb-12 relative px-4">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -z-10"></div>
        <div 
            className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 -z-10 transition-all duration-700 ease-out"
            style={{ width: `${(currentStep / (GenerationStep.COMPLETE)) * 100}%` }}
        ></div>

        {visualSteps.map((step, idx) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = step.activeOn.includes(currentStep);
          // Allow navigation back if we are past this step
          const canClick = currentStep > step.id && step.id !== GenerationStep.TEXT_SEARCH; 

          return (
            <div 
                key={step.id} 
                onClick={() => canClick ? setCurrentStep(step.id) : null}
                className={`flex flex-col items-center gap-2 bg-slate-900 px-2 z-10 ${canClick ? 'cursor-pointer hover:opacity-80' : ''}`}
            >
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 border-2 
                ${isCompleted || isCurrent 
                  ? 'bg-slate-900 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-110' 
                  : 'bg-slate-800 border-slate-700 text-slate-600'}`}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>
              <span className={`text-[10px] uppercase tracking-widest font-semibold hidden sm:block ${isCompleted || isCurrent ? 'text-indigo-300' : 'text-slate-700'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 font-sans selection:bg-indigo-500/30">
       
       {/* Sidebar */}
       <div className={`fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-800 shadow-2xl transform transition-transform duration-300 z-50 ${showHistory ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-lg">Historial</h3>
                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto h-[calc(100vh-64px)]">
                {history.length === 0 ? (
                    <p className="text-slate-500 text-center py-10 text-sm">No hay noticias guardadas.</p>
                ) : (
                    history.map(h => (
                        <button 
                            key={h.id} 
                            onClick={() => handleLoadFromHistory(h)}
                            className="w-full text-left p-3 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-all group"
                        >
                            <p className="text-[10px] text-indigo-400 mb-1">{new Date(h.createdAt).toLocaleDateString()}</p>
                            <h4 className="font-semibold text-sm text-slate-200 group-hover:text-white line-clamp-2">{h.title}</h4>
                            <div className="flex gap-2 mt-2">
                                <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800 uppercase">{h.language}</span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>

       {/* Top Bar */}
       <div className="flex justify-between items-center max-w-6xl mx-auto mb-8">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xl tracking-tighter cursor-pointer" onClick={handleReset}>
            <span className="text-2xl text-indigo-500">✦</span> NewsGen AI
          </div>
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setShowHistory(true)}
                className="text-xs font-medium text-slate-400 hover:text-white px-3 py-2 transition-all flex items-center gap-2"
             >
                <span>📜</span> <span className="hidden sm:inline">Historial</span>
             </button>
             <button 
                onClick={handleOpenKeySettings}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
                title="Configurar API Key"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </button>
          </div>
      </div>

      <div className="max-w-5xl mx-auto pt-4 pb-20">
        
        {renderStepper()}

        <div className="min-h-[450px]">
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl mb-8 text-center backdrop-blur-md animate-shake">
                    {error}
                </div>
            )}

            {/* STEP 1: INPUT UI */}
            {currentStep === GenerationStep.INPUT && (
                <div className="w-full max-w-2xl mx-auto animate-fade-in-up animation-delay-100">
                     
                     {/* SEPARATED Toolbar: Language & Length */}
                    <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
                         
                         {/* Language Group */}
                         <div className="bg-slate-800/80 border border-slate-700 rounded-full p-1.5 flex gap-1 shadow-lg backdrop-blur-sm">
                            {LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => setSelectedLanguage(lang.code)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all
                                        ${selectedLanguage === lang.code 
                                            ? 'bg-slate-200 text-slate-900' 
                                            : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    {lang.label}
                                </button>
                            ))}
                         </div>

                         {/* Length Group */}
                         <div className="bg-slate-800/80 border border-slate-700 rounded-full p-1.5 flex gap-1 shadow-lg backdrop-blur-sm">
                            {LENGTHS.map((len) => (
                                <button
                                    key={len.code}
                                    onClick={() => setSelectedLength(len.code)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all
                                        ${selectedLength === len.code 
                                            ? 'bg-indigo-600 text-white shadow-md' 
                                            : 'text-slate-400 hover:text-slate-200'}`}
                                    title={len.desc}
                                >
                                    {len.label}
                                </button>
                            ))}
                         </div>
                    </div>

                    <div className="bg-slate-800/40 backdrop-blur-xl border border-white/5 rounded-3xl p-1 shadow-2xl">
                        
                        {/* Mode Tabs */}
                        <div className="flex p-1 bg-slate-900/50 rounded-2xl mb-6">
                            <button 
                                onClick={() => setInputMode('topic')}
                                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${inputMode === 'topic' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                🔍 Investigar Tema
                            </button>
                            <button 
                                onClick={() => setInputMode('document')}
                                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${inputMode === 'document' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                📄 Analizar Documento
                            </button>
                        </div>

                        <div className="px-6 pb-8 pt-2 space-y-6">
                            {inputMode === 'topic' ? (
                                <div className="space-y-4">
                                    <input 
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && startGeneration()}
                                        placeholder={placeholderText}
                                        className="w-full bg-slate-950/50 border border-slate-700 text-white px-6 py-5 rounded-xl text-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                                        autoFocus
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all group
                                            ${selectedFile ? 'border-purple-500/50 bg-purple-500/5' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'}`}
                                    >
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            accept=".pdf,.txt,.md"
                                            onChange={handleFileChange} 
                                        />
                                        {selectedFile ? (
                                            <div className="flex items-center justify-center gap-3 text-purple-300">
                                                <span className="font-medium text-lg">{selectedFile.name}</span>
                                            </div>
                                        ) : (
                                            <p className="text-slate-500">Haz clic para subir PDF o TXT</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Advanced Toggle */}
                            <div>
                                <button 
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"
                                >
                                    <span>{showAdvanced ? '−' : '+'}</span>
                                    Configuración Avanzada
                                </button>
                                {showAdvanced && renderAdvancedSettings()}
                            </div>

                            <button
                                onClick={startGeneration}
                                disabled={(inputMode === 'topic' && !inputValue.trim()) || (inputMode === 'document' && !selectedFile)}
                                className="w-full bg-white text-slate-900 hover:bg-indigo-50 disabled:opacity-50 disabled:hover:bg-white font-bold py-4 rounded-xl shadow-xl shadow-white/10 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
                            >
                                {inputMode === 'topic' ? 'Generar Artículo' : 'Analizar y Generar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LOADING STATES (TEXT OR FINAL AUDIO) */}
            {(currentStep === GenerationStep.TEXT_SEARCH || isFinalizing) && (
                <div className="flex flex-col items-center justify-center h-[400px] space-y-8 animate-fade-in">
                    <div className="relative w-32 h-32">
                        <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-indigo-500 border-r-purple-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                             <span className="text-4xl animate-pulse">✨</span>
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-medium text-white tracking-tight">{statusMessage}</h3>
                        <p className="text-slate-500">NewsGen AI está trabajando...</p>
                    </div>
                </div>
            )}

            {/* STEP 2: TEXT REVIEW */}
            {currentStep === GenerationStep.TEXT_REVIEW && article && (
                 <div className="max-w-4xl mx-auto animate-slide-up">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-8">
                        <div className="mb-6 text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">Revisión de Redacción</h2>
                            <p className="text-slate-400 text-sm">Edita el título y el contenido antes de generar la multimedia.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-slate-400 text-xs font-bold uppercase tracking-wide">Título</label>
                                <input 
                                    type="text" 
                                    value={article.title}
                                    onChange={(e) => setArticle({ ...article, title: e.target.value, audioUrl: undefined })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-lg font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-slate-400 text-xs font-bold uppercase tracking-wide">Contenido</label>
                                <textarea 
                                    value={article.content}
                                    onChange={(e) => setArticle({ ...article, content: e.target.value, audioUrl: undefined })}
                                    className="w-full h-96 bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-slate-300 leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-light"
                                />
                            </div>
                        </div>

                        <div className="flex justify-center gap-4 pt-8 mt-4 border-t border-slate-800">
                            <button
                                onClick={() => setCurrentStep(GenerationStep.INPUT)}
                                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmText}
                                className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-1"
                            >
                                Confirmar y Generar Multimedia →
                            </button>
                        </div>
                    </div>
                 </div>
            )}

            {/* STEP 3: MEDIA REVIEW */}
            {currentStep === GenerationStep.MEDIA_REVIEW && article && (
                <div className="max-w-4xl mx-auto animate-slide-up">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-8">
                        <div className="mb-6 text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">Revisión de Multimedia</h2>
                            <p className="text-slate-400 text-sm">Personaliza las imágenes o videos antes de publicar la historia.</p>
                        </div>

                        {/* Media Grid */}
                        {isGeneratingImages ? (
                             <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-4">
                                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <p>Generando ilustraciones con Imagen 3...</p>
                             </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                {article.media.map((item, idx) => (
                                    <div key={idx} className="relative group aspect-video rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                                        {item.type === 'video' ? (
                                            <video src={getMediaSrc(item)} className="w-full h-full object-cover" controls={false} />
                                        ) : (
                                            <img src={getMediaSrc(item)} className="w-full h-full object-cover" alt={`Generated ${idx}`} />
                                        )}
                                        
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => handleRemoveMedia(idx)}
                                                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transform hover:scale-110 transition-all"
                                                title="Eliminar"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        {item.type === 'video' && <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded">VIDEO</span>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ADD MEDIA SECTION */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-8">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Agregar Multimedia Extra</h3>
                            <div className="flex flex-col md:flex-row gap-4">
                                 {/* File Upload */}
                                 <div 
                                    onClick={() => mediaUploadRef.current?.click()}
                                    className="flex-1 border-2 border-dashed border-slate-600 hover:border-indigo-500 hover:bg-slate-700/30 rounded-lg p-4 text-slate-400 hover:text-indigo-400 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                 >
                                    <input 
                                        type="file" 
                                        ref={mediaUploadRef} 
                                        className="hidden" 
                                        accept="image/*,video/*" 
                                        onChange={handleUserMediaUpload}
                                    />
                                    <span>📂</span> Subir Archivo (PC)
                                 </div>
                                 
                                 {/* URL Input */}
                                 <div className="flex-[2] flex gap-2">
                                    <input 
                                        type="text" 
                                        value={mediaUrlInput}
                                        onChange={(e) => setMediaUrlInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddUrlMedia()}
                                        placeholder="Pegar URL de imagen o video (Ej: picsum.photos/800/600)"
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white placeholder-slate-600"
                                    />
                                    <button 
                                        onClick={handleAddUrlMedia}
                                        disabled={!mediaUrlInput.trim()}
                                        className="bg-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-lg font-medium transition-colors whitespace-nowrap"
                                    >
                                        + URL
                                    </button>
                                 </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 italic">
                                Soporta imágenes (JPG, PNG) y videos directos (MP4). Para servicios como Pexels, usa el enlace directo al archivo.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4 border-t border-slate-800">
                            <button 
                                onClick={handleBackToText}
                                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-all"
                            >
                                ← Editar Texto
                            </button>
                            <button
                                onClick={handleRegenerateImages}
                                disabled={isGeneratingImages}
                                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isGeneratingImages ? 'Generando...' : '🔄 Regenerar con IA'}
                            </button>
                            <button
                                onClick={finalizeArticle}
                                className="px-8 py-3 rounded-xl bg-white hover:bg-indigo-50 text-slate-900 font-bold shadow-lg shadow-white/10 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
                            >
                                <span>Publicar Historia</span>
                                <span>→</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 4: RESULT */}
            {currentStep === GenerationStep.COMPLETE && article && (
                <div className="animate-slide-up space-y-12 pb-20">
                    
                    {/* ARTICLE CARD */}
                    <div className="group relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl hover:shadow-indigo-900/20 transition-all duration-500">
                        
                        {/* Decorative Glow */}
                        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl group-hover:bg-indigo-600/30 transition-all duration-700 pointer-events-none"></div>

                        {/* CAROUSEL HEADER */}
                        <div className="relative w-full aspect-[16/9] md:aspect-[21/9] bg-slate-950 overflow-hidden">
                            {article.media && article.media.length > 0 ? (
                                <>
                                    {/* Media Stack */}
                                    {article.media.map((item, idx) => (
                                        <div 
                                            key={idx}
                                            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out
                                                ${idx === currentMediaIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
                                        >
                                            {item.type === 'video' ? (
                                                <video 
                                                    ref={el => (videoRefs.current[idx] = el)}
                                                    src={getMediaSrc(item)}
                                                    className="w-full h-full object-cover"
                                                    onEnded={() => {
                                                        // Ensure we loop
                                                        nextMedia();
                                                    }} 
                                                    muted
                                                    playsInline
                                                    loop={false} // rely on onEnded to go to next
                                                />
                                            ) : (
                                                <img 
                                                    src={getMediaSrc(item)}
                                                    alt={`Slide ${idx}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                            {/* Gradient Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                                        </div>
                                    ))}

                                    {/* Navigation */}
                                    {article.media.length > 1 && (
                                        <>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); prevMedia(); }}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:bg-black/60 flex items-center justify-center transition-all z-20 border border-white/10"
                                            >
                                                ←
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); nextMedia(); }}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:bg-black/60 flex items-center justify-center transition-all z-20 border border-white/10"
                                            >
                                                →
                                            </button>
                                            {/* Dots */}
                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                                                {article.media.map((_, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setCurrentMediaIndex(idx)}
                                                        className={`h-1.5 rounded-full transition-all duration-300 
                                                            ${idx === currentMediaIndex ? 'bg-white w-6' : 'bg-white/40 w-2 hover:bg-white/60'}`}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                // Fallback if no images
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-500">
                                    <span className="text-4xl mb-2">📰</span>
                                    <span className="text-sm font-mono">Visualizando Contenido...</span>
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                                </div>
                            )}
                            
                            {/* Title Overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 z-20 pointer-events-none">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider shadow-lg">
                                        {advancedSettings.tone}
                                    </span>
                                    <span className="text-slate-300 text-xs font-mono bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
                                        {new Date().toLocaleDateString()}
                                    </span>
                                </div>
                                <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight max-w-4xl drop-shadow-2xl">
                                    {article.title}
                                </h2>
                            </div>
                        </div>

                        {/* AUDIO PLAYER */}
                        <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-4 md:px-10 flex items-center gap-4 shadow-lg">
                            <div className="w-10 h-10 flex flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 animate-pulse">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="flex-grow">
                                {article.audioUrl ? (
                                    <audio controls className="w-full h-8 md:h-10 custom-audio" src={article.audioUrl}>
                                    </audio>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span className="w-2 h-2 bg-red-500 rounded-full"></span> Sin audio
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BODY CONTENT */}
                        <div className="p-6 md:p-12 max-w-4xl mx-auto">
                            <div className="prose prose-invert prose-lg md:prose-xl max-w-none text-slate-300/90 leading-loose font-light">
                                {article.content.split('\n').map((paragraph, i) => {
                                    if (!paragraph.trim()) return null;
                                    if (paragraph.startsWith('#')) {
                                        return <h3 key={i} className="text-white font-bold mt-10 mb-4 text-2xl">{paragraph.replace(/#/g, '')}</h3>
                                    }
                                    return <p key={i} className="mb-6 text-justify first:first-letter:text-5xl first:first-letter:font-bold first:first-letter:text-indigo-400 first:first-letter:mr-2 first:first-letter:float-left">{paragraph}</p>;
                                })}
                            </div>

                            {/* SEO & METADATA SECTION */}
                            <div className="mt-12 mb-8 flex flex-wrap gap-2">
                                {article.keywords && article.keywords.map((k, i) => (
                                    <span key={i} className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">#{k}</span>
                                ))}
                            </div>
                            {article.metaDescription && (
                                <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-lg mb-8">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Meta Description</p>
                                    <p className="text-sm text-slate-400 italic">"{article.metaDescription}"</p>
                                </div>
                            )}

                            {/* SOURCES FOOTER */}
                            {article.sources && article.sources.length > 0 && (
                                <div className="mt-12 pt-8 border-t border-slate-800">
                                    <h4 className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-6 flex items-center gap-2">
                                        <span className="w-4 h-px bg-slate-700"></span> Fuentes Consultadas
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {article.sources.map((source, idx) => (
                                            <a 
                                                key={idx}
                                                href={source.uri}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="group flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/30 transition-all"
                                            >
                                                <div className="mt-1 w-5 h-5 flex items-center justify-center rounded bg-slate-700 text-slate-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                                    <span className="text-[10px] font-bold">{idx + 1}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-300 truncate group-hover:text-indigo-300 transition-colors">
                                                        {source.title}
                                                    </p>
                                                    <p className="text-xs text-slate-500 truncate font-mono">
                                                        {source.uri}
                                                    </p>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-center gap-4 pb-8">
                        <button 
                            onClick={handleBackToText}
                            className="flex items-center gap-2 bg-slate-800 text-slate-200 hover:bg-slate-700 px-6 py-3 rounded-full font-bold shadow-lg transition-all"
                        >
                            📝 Editar Redacción
                        </button>
                        <button 
                            onClick={handleBackToMedia}
                            className="flex items-center gap-2 bg-slate-800 text-slate-200 hover:bg-slate-700 px-6 py-3 rounded-full font-bold shadow-lg transition-all"
                        >
                            🖼️ Editar Multimedia
                        </button>
                        <button 
                            onClick={handleReset}
                            className="flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-200 px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Crear Nueva Historia
                        </button>
                    </div>

                    <div className="opacity-40 hover:opacity-100 transition-opacity">
                         <CodeBlock 
                            label="Gemini Advanced Prompt Construction"
                            code={`const systemPrompt = \`Target Audience: \${settings.audience}
Tone: \${settings.tone}
Visual Style: \${settings.visualStyle}

Structure:
|||HEADLINE|||
|||BODY|||
|||IMAGE_PROMPT|||
|||METADATA (JSON)|||
\`;`}
                         />
                    </div>
                </div>
            )}
      </div>
    </div>