import { useState, useRef, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import PromptInput from './PromptInput';
import ImagePreview from './ImagePreview';
import { Card } from './ui/Card';

const POLLINATIONS_BASE_URL = 'https://image.pollinations.ai/prompt/';

/**
 * Builds the Pollinations AI image URL according to requirements:
 * 1. Convert line breaks to spaces before URL encoding.
 * 2. URL encode the prompt.
 * 3. Prepend base URL https://image.pollinations.ai/prompt/
 * 4. Append optional seed for regeneration.
 */
export function buildPollinationsUrl(prompt, seed = null) {
  if (!prompt || typeof prompt !== 'string') return '';

  // Requirement 12: Preserve line breaks by converting them to spaces before URL encoding
  const sanitized = prompt.replace(/[\r\n]+/g, ' ').trim();
  if (!sanitized) return '';

  // Requirement 10: URL encode every prompt before sending
  const encodedPrompt = encodeURIComponent(sanitized);

  let url = `${POLLINATIONS_BASE_URL}${encodedPrompt}`;
  if (seed !== null && seed !== undefined) {
    url += `?seed=${seed}`;
  }
  return url;
}

/**
 * ImageGenerator component
 * Main modular container for Pollinations AI image generation.
 * Operates 100% frontend, no API keys, no backend required, memory caching only.
 */
export default function ImageGenerator({ initialPrompt = '', title = 'Pollinations AI Image Generator' }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Requirement 17: Cache only in browser memory
  const memoryCache = useRef(new Map());

  const generateImage = useCallback(async (textPrompt, seed = null) => {
    if (!textPrompt || textPrompt.trim().length === 0) {
      setError('Invalid prompt. Please enter a valid prompt before generating.');
      return;
    }

    const sanitized = textPrompt.replace(/[\r\n]+/g, ' ').trim();
    if (sanitized.length > 2000) {
      setError('Prompt is too long. Maximum prompt length is 2000 characters.');
      return;
    }

    const cacheKey = seed !== null ? `${sanitized}_seed_${seed}` : sanitized;

    // Check browser memory cache
    if (seed === null && memoryCache.current.has(cacheKey)) {
      setImageUrl(memoryCache.current.get(cacheKey));
      setError(null);
      return;
    }

    // Requirement 6: Disable Generate button, show loading indicator
    setLoading(true);
    setError(null);

    const targetUrl = buildPollinationsUrl(sanitized, seed);

    try {
      // Requirement 19 & 7: Asynchronous load & error/timeout handling
      await new Promise((resolve, reject) => {
        const img = new Image();
        const timeoutId = setTimeout(() => {
          img.src = '';
          reject(
            new Error(
              'Network timeout while loading image from Pollinations AI. Please check your internet connection and try again.'
            )
          );
        }, 30000); // 30 second timeout

        img.onload = () => {
          clearTimeout(timeoutId);
          resolve(targetUrl);
        };

        img.onerror = () => {
          clearTimeout(timeoutId);
          reject(
            new Error(
              'Failed to load image from Pollinations AI. Please verify your prompt or try again shortly.'
            )
          );
        };

        img.src = targetUrl;
      });

      // Requirement 17: Store in browser memory cache
      memoryCache.current.set(cacheKey, targetUrl);
      setImageUrl(targetUrl);
    } catch (err) {
      // Requirement 7: Show user-friendly error message
      setError(err.message || 'Image generation failed. Please try again.');
    } finally {
      // Requirement 6: Re-enable Generate button
      setLoading(false);
    }
  }, []);

  const handleGenerate = () => {
    generateImage(prompt);
  };

  // Requirement 14: Regenerate button requests the same prompt again with a new seed
  const handleRegenerate = () => {
    const randomSeed = Math.floor(Math.random() * 1000000);
    generateImage(prompt, randomSeed);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-900 flex items-center gap-2">
            <Sparkles className="text-brand-600" size={20} />
            {title}
          </h2>
          <p className="text-xs text-ink-500 mt-1">
            Generate photorealistic images dynamically with Pollinations AI. 100% Client-Side. No API Keys required.
          </p>
        </div>
      </div>

      {/* Main Container Card */}
      <Card className="p-6 space-y-6 bg-white border-ink-200 shadow-sm rounded-2xl">
        {/* Requirement 15: PromptInput modular component */}
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          onGenerate={handleGenerate}
          loading={loading}
          disabled={loading}
        />

        <hr className="border-ink-100" />

        {/* Requirement 15: ImagePreview modular component */}
        <ImagePreview
          imageUrl={imageUrl}
          prompt={prompt}
          loading={loading}
          error={error}
          onRegenerate={handleRegenerate}
          onRetry={handleGenerate}
        />
      </Card>
    </div>
  );
}
