import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  generateNewsContent, 
  generateNewsImages, 
  generateNewsAudio, 
  generateSocialPost 
} from './services/geminiService';
import { searchPexels } from './services/pexelsService';
import { 
  GenerationStep, 
  NewsArticle, 
  InputMode, 
  UploadedFile, 
  Language, 
  ArticleLength, 
  AdvancedSettings, 
  MediaItem, 
  SourceGroup,
  ProjectConfig
} from './types';
import { getMediaSrc } from './utils';
import { setGeminiApiKey } from './services/geminiService';
import { setPexelsApiKey } from './services/pexelsService';
import { PLACEHOLDERS, getRegionPreferredDomains } from './constants';

import { Header } from './components/Header';
import { StepInput } from './components/StepInput';
import { StepTextReview } from './components/StepTextReview';
import { StepMediaReview } from './components/StepMediaReview';
import { StepComplete } from './components/StepComplete';
import { HistorySidebar } from './components/HistorySidebar';
import { EmbedModal } from './components/EmbedModal';
import { SocialModal } from './components/SocialModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';

import './styles/main.css';

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
    preferredDomains: getRegionPreferredDomains('world'),
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

  const envGeminiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const envPexelsKey = import.meta.env.VITE_PEXELS_API_KEY || '';

  const [projectConfig, setProjectConfig] = useState<ProjectConfig>(() => {
    if (typeof window === 'undefined') {
      return {
        geminiApiKey: envGeminiKey,
        pexelsApiKey: envPexelsKey,
        preferredDomains: getRegionPreferredDomains('world'),
        blockedDomains: []
      };
    }
    try {
      const stored = localStorage.getItem('newsgen_project_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          geminiApiKey: parsed.geminiApiKey || envGeminiKey,
          pexelsApiKey: parsed.pexelsApiKey || envPexelsKey,
          preferredDomains: parsed.preferredDomains || getRegionPreferredDomains('world'),
          blockedDomains: parsed.blockedDomains || []
        };
      }
    } catch (e) {
      console.warn('Failed to parse project config', e);
    }
    return {
      geminiApiKey: envGeminiKey,
      pexelsApiKey: envPexelsKey,
      preferredDomains: getRegionPreferredDomains('world'),
      blockedDomains: []
    };
  });
  const [showProjectSettings, setShowProjectSettings] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem('newsgen_theme') as 'light' | 'dark') || 'dark';
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaUploadRef = useRef<HTMLInputElement>(null);

  const groupedSources = useMemo<SourceGroup[]>(() => {
    if (!article?.sources?.length) return [];
    const groups = Object.values(
        article.sources.reduce<Record<string, SourceGroup>>((acc, src) => {
        const domain = (() => {
            const uri = src.uri;

            // Special handling for Vertex AI Search redirect URLs: use title as domain label when possible
            if (uri.includes('vertexaisearch') && src.title) {
                const candidate = src.title.trim();
                // Basic heuristic: looks like a domain (contains a dot and no spaces)
                if (candidate.includes('.') && !candidate.includes(' ')) {
                    return candidate;
                }
            }

            try {
                const hostname = new URL(uri).hostname;
                return hostname.replace(/^www\./, '');
            } catch (e) {
                return uri;
            }
        })();

        if (!acc[domain]) {
            acc[domain] = {
                domain,
                occurrences: 0,
                links: [] as { title: string; uri: string }[]
            };
        }

        acc[domain].occurrences += 1;
        acc[domain].links.push({ title: src.title, uri: src.uri });
        return acc;
    }, {} as Record<string, SourceGroup>)
    ) as SourceGroup[];

    return groups.sort((a, b) => b.occurrences - a.occurrences);
  }, [article?.sources]);

  // Apply regional presets when region changes
  useEffect(() => {
    const suggested = getRegionPreferredDomains(advancedSettings.sourceRegion);
    setAdvancedSettings(prev => ({
        ...prev,
        preferredDomains: suggested
    }));
  }, [advancedSettings.sourceRegion]);

  // --- EFFECTS ---

  useEffect(() => {
    const saved = localStorage.getItem('newsgen_history');
    if (saved) {
        try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('newsgen_theme', theme);
  }, [theme]);

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
        idx = (idx + 1) % PLACEHOLDERS.length;
        setPlaceholderText(PLACEHOLDERS[idx]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (projectConfig.geminiApiKey) {
      setGeminiApiKey(projectConfig.geminiApiKey);
    }
    if (projectConfig.pexelsApiKey) {
      setPexelsApiKey(projectConfig.pexelsApiKey);
    }
    setAdvancedSettings(prev => ({
      ...prev,
      preferredDomains: projectConfig.preferredDomains,
      blockedDomains: projectConfig.blockedDomains
    }));
  }, [projectConfig]);

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
    setIncludeAudio(true); 
    setShowSocialModal(false);
    setSocialContentMap({ x: '', linkedin: '', facebook: '' });
  };

  const handleSaveProjectConfig = (config: ProjectConfig) => {
    setProjectConfig(config);
    localStorage.setItem('newsgen_project_config', JSON.stringify(config));
    setShowProjectSettings(false);
  };

  const handleModifySearch = () => {
      setCurrentStep(GenerationStep.INPUT);
  };

  const handleBackToText = () => {
    setCurrentStep(GenerationStep.TEXT_REVIEW);
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
        rawSources: textData.rawSourceChunks,
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
          const mimeType = typeof file.type === 'string' ? file.type : '';
          const isVideo = mimeType.startsWith('video/');
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

  const handleGenerateAudio = async () => {
    if (!article) return;
    setStatusMessage("Generando audio...");
    try {
         const url = await generateNewsAudio(article.content, selectedLanguage, advancedSettings);
         setArticle(prev => prev ? { ...prev, audioUrl: url } : null);
    } catch (e) {
         setError("Error generando audio.");
    } finally {
         setStatusMessage('');
    }
  };

  // STEP 3 -> STEP 4
  const finalizeArticle = async () => {
      if (!article) return;
      setIsFinalizing(true);
      
      try {
          let audioUrl = article.audioUrl;
          
          // Solo generar audio si el usuario lo solicitó Y no se ha generado ya
          if (includeAudio) {
            if (!audioUrl) {
                setStatusMessage("Sintetizando voz humana con la personalidad adecuada...");
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
             if (!audioUrl) audioUrl = undefined; 
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
    ${article.media.length > 0 ? `<div style="margin-bottom: 20px;">Media Item 1</div>` : ''}
    <div style="margin-top:20px;">${article.content.replace(/\n/g, '<br/>')}</div>
    <small>Source: NewsGen AI</small>
</article>`;
  };

  const handleOpenEmbedModal = () => {
      setGeneratedEmbedCode(generateHtmlEmbed());
      setShowEmbedModal(true);
  };

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

      const wordCount = article.content.split(/\s+/).length;
      const readTime = Math.ceil(wordCount / 200);

      const exportData = {
          title: article.title,
          excerpt: article.metaDescription || article.content.substring(0, 120) + "...",
          category: article.keywords?.[0] ? article.keywords[0].charAt(0).toUpperCase() + article.keywords[0].slice(1) : "General",
          author: "NewsGen AI",
          date: dateStr,
          readTime: readTime,
          featured: false,
          audioUrl: article.audioUrl || null,
          content: article.content,
          sources: groupedSources.map(g => g.domain),
          media: article.media.map(m => ({
              type: m.type,
              src: getMediaSrc(m),
              caption: article.imagePrompt || article.title
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

  const getShareUrl = () => {
      const url = encodeURIComponent(window.location.href); 
      const currentText = socialContentMap[socialPlatform];
      
      if (socialPlatform === 'x') return `https://twitter.com/intent/tweet?text=${encodeURIComponent(currentText.substring(0, 280))}`;
      if (socialPlatform === 'linkedin') return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`; 
      if (socialPlatform === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      return '#';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-20">
      
      <Header 
          theme={theme} 
          onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} 
          onReset={handleReset} 
          onShowHistory={() => setShowHistory(true)}
          onLogoSecretClick={() => setShowProjectSettings(true)} 
      />

      <main className="max-w-5xl mx-auto px-6 py-8">
        
        {error && (
            <div className="mb-8 bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {error}
                </div>
                <button onClick={() => setError(null)} className="hover:text-white">✕</button>
            </div>
        )}

        {(statusMessage || isGeneratingImages || isFinalizing) && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center flex-col">
                <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
                <h3 className="text-xl font-bold text-white mb-2">{statusMessage || "Procesando..."}</h3>
                <p className="text-slate-400 animate-pulse">La IA está trabajando en tu contenido</p>
            </div>
        )}

        {currentStep === GenerationStep.INPUT && (
            <StepInput 
                inputMode={inputMode}
                setInputMode={setInputMode}
                inputValue={inputValue}
                setInputValue={setInputValue}
                placeholderText={placeholderText}
                selectedFile={selectedFile}
                fileInputRef={fileInputRef}
                handleFileChange={handleFileChange}
                selectedLanguage={selectedLanguage}
                setSelectedLanguage={setSelectedLanguage}
                selectedLength={selectedLength}
                setSelectedLength={setSelectedLength}
                showAdvanced={showAdvanced}
                setShowAdvanced={setShowAdvanced}
                advancedSettings={advancedSettings}
                setAdvancedSettings={setAdvancedSettings}
                addDomain={addDomain}
                removeDomain={removeDomain}
                prefSourceInput={prefSourceInput}
                setPrefSourceInput={setPrefSourceInput}
                blockedSourceInput={blockedSourceInput}
                setBlockedSourceInput={setBlockedSourceInput}
                onStartGeneration={startGeneration}
            />
        )}

        {currentStep === GenerationStep.TEXT_REVIEW && article && (
            <StepTextReview 
                article={article}
                groupedSources={groupedSources}
                rawSourceChunks={article.rawSources || []}
                onBack={() => setCurrentStep(GenerationStep.INPUT)}
                onConfirm={handleConfirmText}
                onRetryGeneration={startGeneration}
            />
        )}

        {currentStep === GenerationStep.MEDIA_REVIEW && article && (
            <StepMediaReview 
                article={article}
                onBack={handleBackToText}
                pexelsQueryInput={pexelsQueryInput}
                setPexelsQueryInput={setPexelsQueryInput}
                isSearchingPexels={isSearchingPexels}
                onSearchPexels={handleSearchPexelsManual}
                isGeneratingImages={isGeneratingImages}
                onRegenerateImages={handleRegenerateImages}
                onRemoveMedia={handleRemoveMedia}
                handleDragStart={handleDragStart}
                handleDragEnter={handleDragEnter}
                handleSort={handleSort}
                mediaUploadRef={mediaUploadRef}
                handleUserMediaUpload={handleUserMediaUpload}
                mediaUrlInput={mediaUrlInput}
                setMediaUrlInput={setMediaUrlInput}
                handleAddUrlMedia={handleAddUrlMedia}
                includeAudio={includeAudio}
                setIncludeAudio={setIncludeAudio}
                onGenerateAudio={handleGenerateAudio}
                onFinalize={finalizeArticle}
            />
        )}

        {currentStep === GenerationStep.COMPLETE && article && (
            <StepComplete 
                article={article}
                currentMediaIndex={currentMediaIndex}
                videoRefs={videoRefs}
                onPrevMedia={prevMedia}
                onNextMedia={nextMedia}
                onEditMedia={() => setCurrentStep(GenerationStep.MEDIA_REVIEW)}
                onEditText={() => setCurrentStep(GenerationStep.TEXT_REVIEW)}
                onModifySearch={handleModifySearch}
                onOpenSocial={handleOpenSocialModal}
                onDownloadJSON={handleDownloadJSON}
                onOpenEmbed={handleOpenEmbedModal}
                onExportVideo={() => simulateExport('video')}
                isExportingVideo={isExportingVideo}
                exportStatus={exportStatus}
                exportProgress={exportProgress}
                advancedSettings={advancedSettings}
                onReset={handleReset}
                groupedSources={groupedSources}
            />
        )}

      </main>

      <HistorySidebar 
          isOpen={showHistory} 
          onClose={() => setShowHistory(false)} 
          history={history} 
          onLoadArticle={handleLoadFromHistory} 
      />

      <EmbedModal 
          isOpen={showEmbedModal} 
          onClose={() => setShowEmbedModal(false)} 
          embedCode={generatedEmbedCode} 
      />

      {article && (
        <SocialModal 
            isOpen={showSocialModal} 
            onClose={() => setShowSocialModal(false)} 
            platform={socialPlatform} 
            onPlatformChange={handleSocialTabChange} 
            isGenerating={isGeneratingSocial} 
            contentMap={socialContentMap} 
            onRegenerate={handleRegenerateSocial} 
            media={article.media} 
            shareUrl={getShareUrl()} 
        />
      )}

      <ProjectSettingsModal 
          isOpen={showProjectSettings} 
          initialConfig={projectConfig} 
          onClose={() => setShowProjectSettings(false)} 
          onSave={handleSaveProjectConfig} 
      />

    </div>
  );
};
