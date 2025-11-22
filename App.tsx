import React, { useState, useRef, useEffect } from 'react';
import { generateNewsContent, generateNewsImages, generateNewsAudio, generateSocialPost } from './services/geminiService';
import { searchPexels } from './services/pexelsService';
import { GenerationStep, NewsArticle, InputMode, UploadedFile, Language, ArticleLength, AdvancedSettings, MediaItem } from './types';
import { CodeBlock } from './components/CodeBlock';

// --- INDEXED DB UTILS (For Audio Persistence) ---
const DB_NAME = 'NewsGenAudioDB';
const STORE_NAME = 'audio_files';

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

const saveAudioToDB = async (id: string, audioBlob: Blob) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(audioBlob, id);
    } catch (e) {
        console.warn("Failed to save audio to DB", e);
    }
};

const getAudioFromDB = async (id: string): Promise<Blob | null> => {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get(id);
            request.onsuccess = () => resolve(request.result as Blob);
            request.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
};

// --- HELPER: Handle Media Source (Base64 vs URL) ---
const getMediaSrc = (item: MediaItem) => {
  if (item.data.startsWith('http') || item.data.startsWith('https') || item.data.startsWith('//')) {
    return item.data;
  }
  return `data:${item.mimeType};base64,${item.data}`;
};

// --- CONSTANTS ---

const LENGTHS: { code: ArticleLength; label: string; desc: string }[] = [
    { code: 'short', label: 'Breve', desc: '~300' },
    { code: 'medium', label: 'Estándar', desc: '~600' },
    { code: 'long', label: 'Profundo', desc: '~1000' },
];

const LANGUAGES: { code: Language; label: string }[] = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'Inglés' },
    { code: 'fr', label: 'Francés' },
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
    focus: 'general',
    timeFrame: 'any',
    visualStyle: 'photorealistic',
    sourceRegion: 'world',
    preferredDomains: [],
    blockedDomains: [],
    verifiedSourcesOnly: false,
    includeQuotes: false,
    includeStats: false,
    includeCounterArguments: false
  });
  
  // Temp state for Chip Inputs
  const [prefSourceInput, setPrefSourceInput] = useState('');
  const [blockedSourceInput, setBlockedSourceInput] = useState('');

  // Media Input State
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [pexelsQueryInput, setPexelsQueryInput] = useState('');
  const [isSearchingPexels, setIsSearchingPexels] = useState(false);

  const [currentStep, setCurrentStep] = useState<GenerationStep>(GenerationStep.INPUT);
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Audio toggle state
  const [includeAudio, setIncludeAudio] = useState(true);
  
  // Export State
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [showEmbedModal, setShowEmbedModal] = useState(false); 
  const [generatedEmbedCode, setGeneratedEmbedCode] = useState('');

  // Social Media State
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [socialPlatform, setSocialPlatform] = useState<'x' | 'linkedin' | 'facebook'>('x');
  // Separate content for each platform
  const [socialContentMap, setSocialContentMap] = useState<{ x: string; linkedin: string; facebook: string }>({
      x: '',
      linkedin: '',
      facebook: ''
  });
  const [isGeneratingSocial, setIsGeneratingSocial] = useState(false);
  
  // Carousel
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Drag and Drop Refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // History
  const [history, setHistory] = useState<NewsArticle[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaUploadRef = useRef<HTMLInputElement>(null);

  // --- EFFECTS ---

  useEffect(() => {
    const saved = localStorage.getItem('newsgen_history');
    if (saved) {
        try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
        idx = (idx + 1) % PLACEHOLDERS.length;
        setPlaceholderText(PLACEHOLDERS[idx]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentStep !== GenerationStep.COMPLETE || !article?.media || article.media.length === 0) return;
    
    const currentItem = article.media[currentMediaIndex];
    const currentVideo = videoRefs.current[currentMediaIndex];

    videoRefs.current.forEach((vid, idx) => {
        if (vid && idx !== currentMediaIndex) {
            vid.pause();
            vid.currentTime = 0;
        }
    });

    if (currentItem.type === 'video' && currentVideo) {
        setTimeout(() => {
            const playPromise = currentVideo.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log("Autoplay prevented:", error);
                });
            }
        }, 100);
    } else if (currentItem.type === 'image') {
        const interval = setInterval(() => {
            nextMedia();
        }, 6000);
        return () => clearInterval(interval);
    }
  }, [currentStep, currentMediaIndex, article?.media.length]); 
  
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
    setPexelsQueryInput('');
    setIsExportingVideo(false);
    setShowEmbedModal(false);
    setStatusMessage('');
    setIncludeAudio(true); // Reset to default
    setShowSocialModal(false);
    setSocialContentMap({ x: '', linkedin: '', facebook: '' });
  };

  const handleBackToText = () => {
    setCurrentStep(GenerationStep.TEXT_REVIEW);
    setError(null);
  };

  const handleBackToMedia = () => {
    setCurrentStep(GenerationStep.MEDIA_REVIEW);
    setError(null);
  };

  const handleLoadFromHistory = async (savedArticle: NewsArticle) => {
    setArticle(savedArticle);
    setCurrentStep(GenerationStep.COMPLETE);
    setShowHistory(false);
    
    const audioBlob = await getAudioFromDB(savedArticle.id);
    if (audioBlob) {
        const url = URL.createObjectURL(audioBlob);
        setArticle(prev => prev ? { ...prev, audioUrl: url } : null);
    }
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

  // Sort Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
  };
 
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragOverItem.current = position;
  };
 
  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null || !article) return;
    const _media = [...article.media];
    const draggedItemContent = _media[dragItem.current];
    _media.splice(dragItem.current, 1);
    _media.splice(dragOverItem.current, 0, draggedItemContent);
    
    setArticle({ ...article, media: _media });
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // STEP 1 -> STEP 2
  const startGeneration = async () => {
    if (inputMode === 'topic' && !inputValue.trim()) return;
    if (inputMode === 'document' && !selectedFile) return;

    setError(null);
    setCurrentStep(GenerationStep.TEXT_SEARCH);
    setStatusMessage("Investigando fuentes y redactando...");

    try {
      const textData = await generateNewsContent(
          inputValue, inputMode, selectedFile, selectedLanguage, selectedLength, advancedSettings
      );
      
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
      
      const suggestion = textData.keywords[0] || (inputMode === 'topic' ? inputValue : '');
      setPexelsQueryInput(suggestion);

      setCurrentStep(GenerationStep.TEXT_REVIEW);
      setStatusMessage('');
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error inesperado. Verifica tu API Key.");
      setCurrentStep(GenerationStep.INPUT);
      setStatusMessage('');
    }
  };

  // STEP 2 -> STEP 3
  const handleConfirmText = async () => {
      if (!article) return;
      
      setCurrentStep(GenerationStep.MEDIA_REVIEW);
      
      if (article.media.length > 0) return;

      setIsGeneratingImages(true);
      try {
        const pexelsQuery = article.keywords[0] || article.topic;
        
        const [imageBytes, pexelsItems] = await Promise.all([
            generateNewsImages(article.imagePrompt),
            searchPexels(pexelsQuery, 'mixed', 2) 
        ]);

        const aiMediaItems: MediaItem[] = imageBytes.map(b => ({
            type: 'image',
            data: b,
            mimeType: 'image/jpeg'
        }));

        const combinedMedia = [...aiMediaItems, ...pexelsItems];
        setArticle(prev => prev ? { ...prev, media: combinedMedia } : null);
      } catch (e) {
          console.error("Error generating media:", e);
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
          setArticle(prev => prev ? { ...prev, media: [...prev.media, ...newMediaItems] } : null);
      } catch (e) {
          setError("Error regenerando imágenes.");
      } finally {
          setIsGeneratingImages(false);
      }
  };

  const handleSearchPexelsManual = async () => {
      if (!pexelsQueryInput.trim() || !article) return;
      setIsSearchingPexels(true);
      try {
          const items = await searchPexels(pexelsQueryInput, 'mixed', 4); 
          setArticle(prev => prev ? { ...prev, media: [...prev.media, ...items] } : null);
          setPexelsQueryInput('');
      } catch (e) {
          setError("Error buscando en Pexels.");
      } finally {
          setIsSearchingPexels(false);
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
    const isVideo = /\.(mp4|webm|ogg|mov)|pexel/i.test(url) || url.includes('video');
    
    const newItem: MediaItem = {
        type: isVideo ? 'video' : 'image',
        data: url,
        mimeType: isVideo ? 'video/mp4' : 'image/jpeg' 
    };
    
    setArticle(prev => prev ? { ...prev, media: [...prev.media, newItem] } : null);
    setMediaUrlInput('');
  };

  const handleRemoveMedia = (index: number) => {
      if (!article) return;
      const newMedia = article.media.filter((_, i) => i !== index);
      setArticle({ ...article, media: newMedia });
  };

  // STEP 3 -> STEP 4
  const finalizeArticle = async () => {
      if (!article) return;
      setIsFinalizing(true);
      
      try {
          let audioUrl = article.audioUrl;
          
          // Solo generar audio si el usuario lo solicitó
          if (includeAudio) {
            if (!audioUrl) {
                setStatusMessage("Sintetizando voz humana con la personalidad adecuada...");
                // Pass advancedSettings to determine the right voice persona
                audioUrl = await generateNewsAudio(article.content, selectedLanguage, advancedSettings);
                
                try {
                    const audioBlob = await fetch(audioUrl).then(r => r.blob());
                    await saveAudioToDB(article.id, audioBlob);
                } catch (e) {
                    console.warn("Could not persist audio to DB", e);
                }
            } else {
                setStatusMessage("Publicando...");
                await new Promise(resolve => setTimeout(resolve, 800));
            }
          } else {
             audioUrl = undefined; // Asegurar que no se guarde url si se desmarcó
             setStatusMessage("Publicando...");
             await new Promise(resolve => setTimeout(resolve, 800));
          }

          const finalArticle = { ...article, audioUrl };
          
          setArticle(finalArticle);
          setCurrentStep(GenerationStep.COMPLETE);
          
          const newHistory = [finalArticle, ...history].slice(0, 10);
          setHistory(newHistory);
          const historyToSave = newHistory.map(h => ({...h, audioUrl: undefined}));
          localStorage.setItem('newsgen_history', JSON.stringify(historyToSave));
          setStatusMessage('');
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

  // --- EXPORT / EMBED / SOCIAL LOGIC ---
  
  const generateHtmlEmbed = () => {
      if (!article) return '';
      return `<!-- NewsGen AI Article -->
<article style="font-family: system-ui; max-width: 800px; margin: 0 auto;">
    <h1>${article.title}</h1>
    <p><em>${article.metaDescription}</em></p>
    ${article.media.length > 0 ? `<img src="${getMediaSrc(article.media[0])}" style="width: 100%; border-radius: 8px;" />` : ''}
    <div style="margin-top:20px;">${article.content.replace(/\n/g, '<br/>')}</div>
    <small>Source: NewsGen AI</small>
</article>`;
  };

  const handleOpenEmbedModal = () => {
      setGeneratedEmbedCode(generateHtmlEmbed());
      setShowEmbedModal(true);
  };

  // Updated Social Logic
  const triggerSocialGeneration = async (platform: 'x' | 'linkedin' | 'facebook') => {
      if (!article) return;
      setIsGeneratingSocial(true);
      try {
        const content = await generateSocialPost(article, platform);
        setSocialContentMap(prev => ({ ...prev, [platform]: content }));
      } catch (e) {
        setSocialContentMap(prev => ({ ...prev, [platform]: "Error generando contenido." }));
      } finally {
        setIsGeneratingSocial(false);
      }
  };

  const handleOpenSocialModal = async (initialPlatform: 'x' | 'linkedin' | 'facebook' = 'x') => {
    if (!article) return;
    
    setShowSocialModal(true);
    setSocialPlatform(initialPlatform);
    
    // If content for this platform is empty, generate it
    if (!socialContentMap[initialPlatform]) {
        await triggerSocialGeneration(initialPlatform);
    }
  };

  const handleSocialTabChange = async (platform: 'x' | 'linkedin' | 'facebook') => {
      setSocialPlatform(platform);
      if (!socialContentMap[platform]) {
          await triggerSocialGeneration(platform);
      }
  };

  const handleRegenerateSocial = async () => {
      await triggerSocialGeneration(socialPlatform);
  };
  
  const handleDownloadJSON = () => {
      if (!article) return;
      
      const dateStr = new Date(article.createdAt).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
      });

      // Calculate read time (approx 200 wpm)
      const wordCount = article.content.split(/\s+/).length;
      const readTime = Math.ceil(wordCount / 200);

      // Format specifically for Lumina News Store Import
      const exportData = {
          title: article.title,
          excerpt: article.metaDescription || article.content.substring(0, 120) + "...",
          category: article.keywords?.[0] ? article.keywords[0].charAt(0).toUpperCase() + article.keywords[0].slice(1) : "General",
          author: "NewsGen AI",
          date: dateStr,
          readTime: readTime,
          featured: false, // Default
          audioUrl: article.audioUrl || null,
          content: article.content,
          sources: article.sources.map(s => s.uri),
          media: article.media.map(m => ({
              type: m.type,
              src: getMediaSrc(m),
              caption: article.imagePrompt || article.title // Use prompt or title for Auto-Enhance context
          }))
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `newsgen-${article.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const simulateExport = (type: string) => {
    if (!article) return;
    setIsExportingVideo(true);
    setExportStatus("Iniciando renderizado...");
    setExportProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 100) progress = 100;
        setExportProgress(Math.floor(progress));

        if (progress < 30) setExportStatus("Procesando fotogramas...");
        else if (progress < 60) setExportStatus("Mezclando audio...");
        else setExportStatus("Finalizando...");

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                setIsExportingVideo(false);
                alert("Exportación completada (Simulación).");
            }, 500);
        }
    }, 400);
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
                className="bg-transparent border-none outline-none text-sm text-white flex-1 min-w-[120px]"
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addDomain(type, inputValue);
                    }
                }}
            />
        </div>
    </div>
  );
  
  // Helper for share URL logic - now specific to active platform content
  const getShareUrl = () => {
      const url = encodeURIComponent(window.location.href); 
      const currentText = socialContentMap[socialPlatform];
      
      if (socialPlatform === 'x') return `https://twitter.com/intent/tweet?text=${encodeURIComponent(currentText.substring(0, 280))}`;
      if (socialPlatform === 'linkedin') return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`; // LinkedIn API doesn't easily support pre-filling text without SDK, but standard share works
      if (socialPlatform === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      return '#';
  };
  
  const getSocialLabel = () => {
      if (socialPlatform === 'x') return 'X';
      if (socialPlatform === 'linkedin') return 'LinkedIn';
      return 'Facebook';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-20">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={handleReset}>
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                <h1 className="font-bold text-xl tracking-tight">Gener<span className="text-indigo-400">News</span></h1>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={handleOpenKeySettings} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-700 transition-colors flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    API Key
                </button>
                <button onClick={() => setShowHistory(true)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </button>
            </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        
        {/* ERROR TOAST */}
        {error && (
            <div className="mb-8 bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {error}
                </div>
                <button onClick={() => setError(null)} className="hover:text-white">✕</button>
            </div>
        )}

        {/* LOADING OVERLAY */}
        {(statusMessage || isGeneratingImages || isFinalizing) && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center flex-col">
                <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
                <h3 className="text-xl font-bold text-white mb-2">{statusMessage || "Procesando..."}</h3>
                <p className="text-slate-400 animate-pulse">La IA está trabajando en tu contenido</p>
            </div>
        )}

        {/* --- STEP 1: INPUT --- */}
        {currentStep === GenerationStep.INPUT && (
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
                            onClick={startGeneration}
                            disabled={inputMode === 'topic' && !inputValue.trim()}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 px-8 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/30"
                        >
                            {inputMode === 'topic' ? 'Investigar y Redactar' : 'Analizar Documento'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- STEP 2: TEXT REVIEW --- */}
        {currentStep === GenerationStep.TEXT_REVIEW && article && (
            <div className="animate-fade-in max-w-4xl mx-auto">
                <button onClick={() => setCurrentStep(GenerationStep.INPUT)} className="text-indigo-400 hover:text-white mb-4 text-sm flex items-center gap-1">← Volver al inicio</button>
                
                <div className="glass-panel rounded-xl p-8 mb-6">
                    <h2 className="text-3xl font-bold mb-6">{article.title}</h2>
                    
                    <div className="prose prose-invert prose-indigo max-w-none mb-8">
                        {article.content.split('\n').map((line, i) => (
                            <p key={i} className="text-slate-300 mb-2 leading-relaxed">{line}</p>
                        ))}
                    </div>

                    {article.sources.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-700">
                            <h4 className="text-sm font-bold uppercase text-slate-500 mb-3">Fuentes Utilizadas</h4>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {article.sources.map((src, i) => (
                                    <li key={i} className="text-xs bg-slate-800 p-2 rounded flex items-center justify-between">
                                        <span className="truncate flex-1">{src.title}</span>
                                        <a href={src.uri} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-white ml-2">Link ↗</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <button 
                        onClick={handleConfirmText}
                        className="bg-white text-slate-900 font-bold py-3 px-8 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-2"
                    >
                        Aprobar y Generar Multimedia →
                    </button>
                </div>
            </div>
        )}

        {/* --- STEP 3: MEDIA REVIEW --- */}
        {currentStep === GenerationStep.MEDIA_REVIEW && article && (
            <div className="animate-fade-in max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <button onClick={handleBackToText} className="text-slate-400 hover:text-white">← Volver al texto</button>
                    <h2 className="text-2xl font-bold">Curaduría Multimedia</h2>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* PEXELS SEARCH */}
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
                            <button onClick={handleSearchPexelsManual} disabled={isSearchingPexels} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-sm">
                                {isSearchingPexels ? '...' : 'Buscar'}
                            </button>
                        </div>
                    </div>
                    
                    {/* AI IMAGE GENERATION */}
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                        <div>
                            <h4 className="text-sm font-bold mb-1 text-purple-400">Generar Imagen IA</h4>
                            <p className="text-xs text-slate-400">Crea una ilustración única</p>
                        </div>
                        <button onClick={handleRegenerateImages} disabled={isGeneratingImages} className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 px-4 py-2 rounded text-sm border border-purple-500/30">
                            {isGeneratingImages ? 'Generando...' : 'Generar'}
                        </button>
                    </div>
                </div>

                {/* MEDIA GRID - DRAG & DROP */}
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
                                onClick={() => handleRemoveMedia(idx)}
                                className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                            >
                                ✕
                            </button>
                            <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded text-[10px] text-white uppercase">
                                {item.type}
                            </div>
                        </div>
                    ))}
                    
                    {/* UPLOAD SLOT */}
                    <div className="aspect-video border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:bg-slate-800/50 transition-colors">
                         <label className="cursor-pointer flex flex-col items-center">
                            <span className="text-2xl mb-1">+</span>
                            <span className="text-xs">Subir</span>
                            <input ref={mediaUploadRef} type="file" className="hidden" onChange={handleUserMediaUpload} accept="image/*,video/*" />
                         </label>
                    </div>
                </div>
                
                {/* URL INPUT */}
                 <div className="mb-8 flex gap-2">
                    <input 
                        type="text" 
                        value={mediaUrlInput}
                        onChange={(e) => setMediaUrlInput(e.target.value)}
                        placeholder="Pegar URL de imagen o video..."
                        className="bg-transparent border-b border-slate-700 flex-1 py-2 px-1 focus:border-indigo-500 outline-none"
                    />
                    <button onClick={handleAddUrlMedia} className="text-indigo-400 hover:text-white text-sm">Añadir URL</button>
                </div>

                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-8 flex items-center justify-between">
                     <div>
                        <h4 className="font-medium text-white">Narración de Audio (TTS)</h4>
                        <p className="text-xs text-slate-400">Generar versión de audio del artículo.</p>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>

                <button 
                    onClick={finalizeArticle}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-900/20 transition-all transform hover:scale-[1.01]"
                >
                    Publicar Artículo Final
                </button>
            </div>
        )}

        {/* --- STEP 4: COMPLETE --- */}
        {currentStep === GenerationStep.COMPLETE && article && (
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
                                    <button onClick={prevMedia} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur z-30 opacity-0 group-hover:opacity-100 transition-opacity">←</button>
                                    <button onClick={nextMedia} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur z-30 opacity-0 group-hover:opacity-100 transition-opacity">→</button>
                                    
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
                         {article.content.split('\n').map((line, i) => {
                            if (line.startsWith('###')) return <h3 key={i} className="text-2xl font-bold text-white mt-8 mb-4">{line.replace(/#/g,'')}</h3>;
                            return <p key={i} className="text-slate-300 mb-4 leading-relaxed">{line}</p>;
                        })}
                    </div>
                    
                </div>

                {/* SIDEBAR ACTIONS */}
                <div className="space-y-6">
                    <div className="glass-panel p-6 rounded-xl sticky top-24">
                        <h3 className="font-bold text-lg mb-4">Acciones</h3>
                        
                        {/* Navigation / Edit Controls */}
                        <div className="grid grid-cols-2 gap-2 mb-4 pb-4 border-b border-slate-700/50">
                            <button 
                                onClick={() => setCurrentStep(GenerationStep.MEDIA_REVIEW)}
                                className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-lg text-xs font-bold transition-colors"
                                title="Volver a editar imágenes y videos"
                            >
                                ← Media
                            </button>
                            <button 
                                onClick={() => setCurrentStep(GenerationStep.TEXT_REVIEW)}
                                className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-lg text-xs font-bold transition-colors"
                                title="Volver a revisar el texto"
                            >
                                ← Texto
                            </button>
                             <button 
                                onClick={() => setCurrentStep(GenerationStep.INPUT)}
                                className="col-span-2 flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-lg text-xs font-bold transition-colors"
                                title="Modificar tema y regenerar"
                            >
                                ↺ Modificar Búsqueda (Paso 1)
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            <button onClick={() => handleOpenSocialModal('x')} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                <span className="text-xl">✨</span> Social Studio AI
                            </button>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={handleDownloadJSON} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2 rounded-lg text-sm font-medium">
                                    Descargar JSON
                                </button>
                                <button onClick={handleOpenEmbedModal} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2 rounded-lg text-sm font-medium">
                                    Embed HTML
                                </button>
                            </div>

                            <button onClick={() => simulateExport('video')} disabled={isExportingVideo} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2">
                                {isExportingVideo ? 'Renderizando...' : 'Exportar Video MP4'}
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

                        <button onClick={handleReset} className="w-full mt-6 border border-slate-700 text-slate-400 hover:text-white py-2 rounded-lg text-sm">
                            Crear Nuevo Artículo
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* SOCIAL MODAL */}
        {showSocialModal && article && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                        <h3 className="font-bold text-lg">Social Studio AI</h3>
                        <button onClick={() => setShowSocialModal(false)} className="text-slate-400 hover:text-white">✕</button>
                    </div>
                    
                    {/* TABS */}
                    <div className="flex border-b border-slate-800">
                        {(['x', 'linkedin', 'facebook'] as const).map(platform => (
                            <button
                                key={platform}
                                onClick={() => handleSocialTabChange(platform)}
                                className={`flex-1 py-3 text-sm font-bold transition-colors relative ${socialPlatform === platform ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {platform === 'x' ? 'X (Twitter)' : platform === 'linkedin' ? 'LinkedIn' : 'Facebook'}
                                {socialPlatform === platform && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 flex-1 overflow-y-auto">
                        {isGeneratingSocial ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <>
                                <label className="text-xs uppercase font-bold text-slate-500 mb-2 block">Texto Generado para {getSocialLabel()}</label>
                                <textarea 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-slate-200 h-40 resize-none focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-sm"
                                    value={socialContentMap[socialPlatform]}
                                    readOnly
                                />
                                <div className="flex justify-end mt-2">
                                    <button onClick={handleRegenerateSocial} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        Reescribir
                                    </button>
                                </div>

                                <div className="mt-6">
                                    <label className="text-xs uppercase font-bold text-slate-500 mb-2 block">Media para Adjuntar</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {article.media.slice(0, 4).map((m, i) => (
                                            <div key={i} className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border border-slate-700 relative group">
                                                {m.type === 'video' ? <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500">Video</div> : <img src={getMediaSrc(m)} className="w-full h-full object-cover" alt="thumb" />}
                                                <a 
                                                    href={getMediaSrc(m)} 
                                                    download={`media-${i}.${m.mimeType.split('/')[1]}`}
                                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs transition-opacity"
                                                >
                                                    Descargar
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">* Descarga la imagen/video para adjuntarla manualmente en tu post.</p>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-800 flex justify-end gap-3">
                        <button 
                            onClick={() => {navigator.clipboard.writeText(socialContentMap[socialPlatform]); alert("Texto copiado!");}}
                            className="px-4 py-2 border border-slate-600 rounded-lg hover:bg-slate-800 text-sm font-medium"
                        >
                            Copiar Texto
                        </button>
                        <a 
                            href={getShareUrl()} 
                            target="_blank" 
                            rel="noreferrer"
                            className="px-4 py-2 bg-white text-slate-900 rounded-lg hover:bg-slate-200 text-sm font-bold flex items-center gap-2"
                        >
                            Abrir {getSocialLabel()} ↗
                        </a>
                    </div>
                </div>
            </div>
        )}

        {/* EMBED MODAL */}
        {showEmbedModal && (
             <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg">Embed Code</h3>
                        <button onClick={() => setShowEmbedModal(false)} className="text-slate-400 hover:text-white">✕</button>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">Copia este código HTML para insertar el artículo en tu CMS o sitio web.</p>
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto mb-4">
                        {generatedEmbedCode}
                    </div>
                    <button 
                         onClick={() => {navigator.clipboard.writeText(generatedEmbedCode); alert("Código copiado!");}}
                         className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-bold"
                    >
                        Copiar HTML
                    </button>
                </div>
             </div>
        )}
        
        {/* HISTORY SIDEBAR (Simple implementation) */}
        {showHistory && (
             <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
                 <div className="w-80 bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto animate-fade-in">
                     <div className="flex justify-between items-center mb-6">
                         <h3 className="font-bold text-xl">Historial</h3>
                         <button onClick={() => setShowHistory(false)}>✕</button>
                     </div>
                     <div className="space-y-4">
                         {history.map(h => (
                             <div key={h.id} onClick={() => handleLoadFromHistory(h)} className="bg-slate-800 p-3 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                                 <div className="text-xs text-indigo-400 mb-1">{new Date(h.createdAt).toLocaleDateString()}</div>
                                 <h4 className="font-bold text-sm line-clamp-2 mb-1">{h.title}</h4>
                                 <div className="flex gap-2 text-[10px] text-slate-500">
                                     <span>{h.language.toUpperCase()}</span>
                                     <span>•</span>
                                     <span>{h.media.length} media</span>
                                 </div>
                             </div>
                         ))}
                         {history.length === 0 && <p className="text-slate-500 text-center py-8">No hay historial reciente.</p>}
                     </div>
                 </div>
             </div>
        )}

      </main>
    </div>
  );
};