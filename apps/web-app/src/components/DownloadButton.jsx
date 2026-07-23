import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import ActionButton from './ui/ActionButton';

/**
 * DownloadButton component
 * Downloads the generated image asynchronously as a file.
 */
export default function DownloadButton({ imageUrl, prompt = 'generated-image', disabled = false, className = '' }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!imageUrl || disabled || downloading) return;

    setDownloading(true);
    try {
      // Fetch image asynchronously to create a download blob
      const response = await fetch(imageUrl, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`Failed to fetch image: HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create temporary download link
      const sanitizedName = prompt
        .slice(0, 30)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase() || 'pollinations-image';

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `pollinations-${sanitizedName}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up memory
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.warn('Direct blob download failed, falling back to window.open anchor download:', err);
      // Fallback: trigger anchor download directly via link
      const link = document.createElement('a');
      link.href = imageUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = 'pollinations-image.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ActionButton
      variant="secondary"
      size="sm"
      icon={downloading ? Loader2 : Download}
      onClick={handleDownload}
      disabled={disabled || !imageUrl || downloading}
      className={`${downloading ? 'opacity-70' : ''} ${className}`}
    >
      {downloading ? 'Downloading...' : 'Download Image'}
    </ActionButton>
  );
}
