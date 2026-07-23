import { SpellCheck, Newspaper, PenLine, FileText, ImageIcon } from 'lucide-react';

/**
 * Shared metadata for the four writing tools.
 * Single source for labels, icons, and Sinhala sample content used by
 * the dashboard quick-start chips, App tool config, and history feed.
 */
export const TOOL_META = {
  grammar: {
    id: 'grammar',
    label: 'Grammar Checker',
    shortDesc: 'Fix Sinhala spelling, grammar, and agreement issues.',
    icon: SpellCheck,
    sampleLabel: 'Market report with a typo',
    sample: 'කොළඹ කොටස් වෙළෙඳපොළ මිල දර්ශකවල පසුබැස්මක් අද දිනයේ දී වාර්තා වාර්ථා විය.',
  },
  headlines: {
    id: 'headlines',
    label: 'Headline Generator',
    shortDesc: 'Generate ranked headline candidates from an article.',
    icon: Newspaper,
    sampleLabel: 'Central bank policy story',
    sample:
      'ශ්‍රී ලංකා මහ බැංකුව විසින් අද දින සිය නවතම මූල්‍ය ප්‍රතිපත්ති වාර්තාව නිකුත් කර තිබේ. එහි දැක්වෙන්නේ ඉදිරි මාස කිහිපය තුළ උද්ධමන වේගය තවදුරටත් පහත වැටෙනු ඇති බවයි.',
  },
  rewriter: {
    id: 'rewriter',
    label: 'Style Rewriter',
    shortDesc: 'Shift copy between formal, editorial, sports, and youth desks.',
    icon: PenLine,
    sampleLabel: 'Casual sports blurb',
    sample: 'ක්‍රීඩකයන් තරගය ජයග්‍රහණය කළා. හැමෝම සතුටු වුණා.',
  },
  summarizer: {
    id: 'summarizer',
    label: 'News Summarizer',
    shortDesc: 'Condense long-form articles into tight summaries.',
    icon: FileText,
    sampleLabel: 'Cricket series preview',
    sample:
      'ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම සහ ඉන්දීය ක්‍රිකට් කණ්ඩායම අතර පැවැත්වෙන තරග තුනකින් සමන්විත එක්දින ක්‍රිකට් තරගාවලියේ පළමු තරගය අද කොළඹ ආර්. ප්‍රේමදාස ක්‍රීඩාංගණයේ දී පැවැත්වීමට නියමිතව තිබේ. මෙම තරගාවලිය සඳහා දෙරටේම ප්‍රධාන ක්‍රීඩකයින් රැසක් එක්ව සිටින අතර ප්‍රේක්ෂක උනන්දුව ද ඉහළ මට්ටමක පවතී.',
  },
  image_generator: {
    id: 'image_generator',
    label: 'AI Image Generator',
    shortDesc: 'Generate AI images dynamically with Pollinations AI.',
    icon: ImageIcon,
    sampleLabel: 'Cyberpunk landscape',
    sample: 'A futuristic cyberpunk city at sunset with neon reflections',
  },
};

export const TOOL_LIST = Object.values(TOOL_META);

