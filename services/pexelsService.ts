
import { MediaItem } from "../types";

let pexelsApiKey = import.meta.env.VITE_PEXELS_API_KEY || "";

export const setPexelsApiKey = (key: string) => {
    pexelsApiKey = key;
};

const requirePexelsKey = () => {
    if (!pexelsApiKey) {
        throw new Error("Pexels API Key no configurada. Añade tu clave en Configuración del Proyecto.");
    }
    return pexelsApiKey;
};

export const searchPexels = async (query: string, type: 'image' | 'video' | 'mixed', count: number = 2): Promise<MediaItem[]> => {
    try {
        const key = requirePexelsKey();
        const headers = {
            'Authorization': key
        };

        // Helper to fetch images
        const fetchImages = async (qty: number) => {
            const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${qty}&orientation=landscape&locale=es-ES`;
            const res = await fetch(url, { headers });
            const data = await res.json();
            return (data.photos || []).map((photo: any) => ({
                type: 'image' as const,
                data: photo.src.large2x || photo.src.large, // High quality URL
                mimeType: 'image/jpeg'
            }));
        };

        // Helper to fetch videos
        const fetchVideos = async (qty: number) => {
            const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${qty}&orientation=landscape&locale=es-ES`;
            const res = await fetch(url, { headers });
            const data = await res.json();
            return (data.videos || []).map((video: any) => {
                // Find best quality file (preferably hd, not 4k to save bandwidth on preview)
                const file = video.video_files.find((f: any) => f.height === 720) || video.video_files[0];
                return {
                    type: 'video' as const,
                    data: file.link,
                    mimeType: file.file_type || 'video/mp4'
                };
            });
        };

        if (type === 'mixed') {
            const vidCount = Math.ceil(count / 2);
            const imgCount = count - vidCount;
            const [videos, images] = await Promise.all([fetchVideos(vidCount), fetchImages(imgCount)]);
            return [...videos, ...images];
        } else if (type === 'video') {
            return await fetchVideos(count);
        } else {
            return await fetchImages(count);
        }

    } catch (error) {
        console.error("Pexels API Error:", error);
        throw error instanceof Error ? error : new Error('Error usando la Pexels API');
    }
};
