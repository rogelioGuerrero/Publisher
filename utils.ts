import { MediaItem } from './types';

export const getMediaSrc = (item: MediaItem) => {
  const data = typeof item?.data === 'string' ? item.data : '';

  if (data.startsWith('http') || data.startsWith('https') || data.startsWith('//')) {
    return data;
  }

  if (!data) {
    return '';
  }

  return `data:${item.mimeType};base64,${data}`;
};
