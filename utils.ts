import { MediaItem } from './types';

export const getMediaSrc = (item: MediaItem) => {
  if (item.data.startsWith('http') || item.data.startsWith('https') || item.data.startsWith('//')) {
    return item.data;
  }
  return `data:${item.mimeType};base64,${item.data}`;
};
