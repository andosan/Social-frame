import React, { useState, useRef } from 'react';
import { Sparkles, Plus, Calendar, ArrowRight, LayoutTemplate, Palette, Zap, Loader2, RefreshCw, Layers, CheckCircle, Tag, Megaphone, Lightbulb, Gift, ShoppingBag, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { BannerConfig, Language, LayoutType, Product, BlogPostRow, Position } from '../types';
import { GoogleGenAI } from "@google/genai";
import { supabase } from '../supabase';
import { DEFAULT_CONFIG, PRODUCT_CATEGORIES } from '../constants';

interface InspirationPanelProps {
  onApply: (data: Partial<BannerConfig['content']> & { layout?: LayoutType }) => void;
  onApplyNarrative: (slides: BannerConfig[], postText?: string) => void;
  className?: string;
  primaryColor: string;
  language?: Language;
}

// Get API Key
const GOOGLE_API_KEY = process.env.API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY || '';

type CampaignType = 'seasonal' | 'promotion' | 'feature' | 'insight';

const CAMPAIGN_TYPES: { id: CampaignType; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'seasonal', label: 'Holidays & Seasonal', icon: <Calendar size={18} />, desc: 'New Year, Winter, Events' },
    { id: 'promotion', label: 'Discounts & Sales', icon: <Tag size={18} />, desc: 'Flash sales, limited offers' },
    { id: 'feature', label: 'Product Focus', icon: <ShoppingBag size={18} />, desc: 'Launches, deep dives' },
    { id: 'insight', label: 'Industry Insights', icon: <Lightbulb size={18} />, desc: 'Tips, trends, education' },
];

interface NarrativeIdea {
    id: string;
    title: string;
    description: string;
    postContent: { en: string; sl: string; hr: string };
    generatedBlog: {
        title: { en: string; sl: string; hr: string };
        excerpt: { en: string; sl: string; hr: string };
    };
    slides: SlideConcept[];
}

interface LocalizedText {
    en: string;
    sl: string;
    hr: string;
}

interface SlideConcept {
    role: string;
    layout: LayoutType;
    alignment: 'left' | 'center' | 'right';
    content: {
        heading: LocalizedText;
        subtitle: LocalizedText;
        cta: LocalizedText;
        listItems?: { title: LocalizedText; description: LocalizedText }[];
    };
    searchQuery?: string; 
    categoryFilter?: string;
    blogKeywords?: string;
}

export default function InspirationPanel({ onApply, onApplyNarrative, className, primaryColor, language = 'en' }: InspirationPanelProps) {
  const [topic, setTopic] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedNarrative, setGeneratedNarrative] = useState<NarrativeIdea | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  if (!aiRef.current && GOOGLE_API_KEY) {
    aiRef.current = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  }

  // --- Auto-Suggest Ideas (Jan 2026 Context) ---
  const suggestIdeas = () => {
      const ideas = [
          "New Year, New Gear 2026",
          "Winter Clearance Sale",
          "Back to Office Essentials",
          "Cozy Winter Lifestyle",
          "Valentine's Early Bird"
      ];
      setTopic(ideas[Math.floor(Math.random() * ideas.length)]);
      if (!selectedCampaign) setSelectedCampaign('seasonal');
  };

  // --- Database Helpers ---
  const fetchBestProduct = async (query: string, category?: string): Promise<Product | null> => {
      try {
          // Fallback if query is empty
          if (!query) return null;

          let dbQuery = supabase
            .from('XD')
            .select('*')
            .neq('IsDiscontinued', true)
            .limit(5); // Fetch a few to find best image match

          if (category && category !== 'General') {
              dbQuery = dbQuery.eq('MainCategory', category);
          }

          // Robust Search: Use simple ILIKE for broad compatibility
          // Split terms to find any match if multiple words provided
          const cleanQuery = query.replace(/[^\w\s]/gi, '').trim();
          if (cleanQuery) {
              const terms = cleanQuery.split(/\s+/).filter(t => t.length > 2);
              if (terms.length > 0) {
                  // Construct an OR filter for ItemName containing any of the terms
                  const orClause = terms.map(term => `ItemName.ilike.%${term}%`).join(',');
                  dbQuery = dbQuery.or(orClause);
              } else {
                  dbQuery = dbQuery.ilike('ItemName', `%${cleanQuery}%`);
              }
          }

          const { data } = await dbQuery;
          
          // Prioritize results that have images
          if (data && data.length > 0) {
              const withImages = data.find((p: any) => p.MainImage || p.AllImages);
              return withImages || data[0];
          }
          return null;
      } catch (e) {
          console.error("Product fetch failed", e);
          return null;
      }
  };

  const fetchBestBlog = async (keywords: string): Promise<BlogPostRow | null> => {
      try {
          const { data } = await supabase
            .from('blog_posts')
            .select('*')
            .eq('status', 'published')
            .ilike('title_en', `%${keywords.split(' ')[0]}%`)
            .limit(1);
          return data && data.length > 0 ? data[0] : null;
      } catch (e) {
          return null;
      }
  };

  // --- Generation Logic ---

  const handleGenerateNarrative = async () => {
    if (!topic.trim() || !aiRef.current) return;
    setIsGenerating(true);
    setGeneratedNarrative(null);

    try {
        const campaignContext = CAMPAIGN_TYPES.find(c => c.id === selectedCampaign)?.label || 'General';
        
        // Inject available categories to help the AI suggest real product lines
        const categoriesContext = PRODUCT_CATEGORIES.join(', ');

        const prompt = `
          Context: Today is January 2026.
          Role: Expert Social Media Manager.
          Task: Create a 3-5 slide carousel campaign.
          
          Topic: "${topic}"
          Campaign Type: ${campaignContext}
          
          Available Product Categories (Use these to inspire List items):
          ${categoriesContext}

          CAMPAIGN GUIDELINES:
          - Seasonal: Focus on Jan/Feb events (New Year, Winter, Valentine's).
          - Discount: Focus on percentages, urgency, clear CTAs.
          - Feature: Deep dive into product benefits.
          - Insight: Educational value, tips.

          SLIDE LAYOUT LOGIC:
          - Slide 1 (Hook): 'standard' or 'image-grid'. Alignment: 'center' or 'left'.
          - Slide 2 (Value/List): Use 'list' layout to show top 3-4 benefits or product categories.
          - Slide 3 (Product): MUST use 'product' layout if selling something. Alignment: 'bottom-right'.
          - Slide 4 (Trust/Info): 'blog' (if article relevant) or 'brand'.
          - Slide 5 (CTA): 'brand' or 'standard'. Alignment: 'center'.

          REQUIRED JSON OUTPUT:
          {
            "title": "Campaign Name",
            "description": "Strategy summary",
            "postContent": { "en": "LinkedIn/Insta caption...", "sl": "...", "hr": "..." },
            "generatedBlog": { 
                "title": { "en": "...", "sl": "...", "hr": "..." },
                "excerpt": { "en": "...", "sl": "...", "hr": "..." }
            },
            "slides": [
              {
                "role": "Intro",
                "layout": "standard", 
                "alignment": "center",
                "content": {
                    "heading": { "en": "...", "sl": "...", "hr": "..." },
                    "subtitle": { "en": "...", "sl": "...", "hr": "..." },
                    "cta": { "en": "", "sl": "", "hr": "" },
                    "listItems": [ 
                        { 
                           "title": { "en": "Optional Bold Title", "sl": "...", "hr": "..." }, 
                           "description": { "en": "Description line", "sl": "...", "hr": "..." }
                        }
                    ]
                },
                "searchQuery": "keyword for product database"
              }
            ]
          }
        `;

        const response = await aiRef.current.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
        });

        const jsonStr = response?.text;
        if (jsonStr) {
            const data = JSON.parse(jsonStr);
            // Ensure slides array exists
            const safeData = {
                ...data,
                slides: Array.isArray(data.slides) ? data.slides : []
            };
            setGeneratedNarrative({ ...safeData, id: Date.now().toString() });
        }

    } catch (e) {
        console.error("Generation failed", e);
        alert("Failed to generate. Try a simpler topic.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleApplyToDeck = async () => {
      if (!generatedNarrative || !generatedNarrative.slides) return;
      setIsGenerating(true);

      try {
          const newSlides: BannerConfig[] = [];
          
          for (const [index, concept] of generatedNarrative.slides.entries()) {
              
              const slide: BannerConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
              slide.id = `${generatedNarrative.id}-${index}`;
              slide.layout = concept.layout;
              
              // Map alignment to position system
              if (concept.alignment === 'left') slide.position = 'center-left';
              else if (concept.alignment === 'right') slide.position = 'bottom-right';
              else slide.position = 'center';

              // If Brand layout, force center
              if (slide.layout === 'brand') slide.position = 'center';

              const c = concept.content || {};
              const getText = (source: any, lang: string) => source?.[lang] || source?.['en'] || '';

              // Apply Text (Display & localized storage)
              slide.content.heading = getText(c.heading, language);
              slide.content.heading_en = getText(c.heading, 'en');
              slide.content.heading_sl = getText(c.heading, 'sl');
              slide.content.heading_hr = getText(c.heading, 'hr');

              slide.content.subtitle = getText(c.subtitle, language);
              slide.content.subtitle_en = getText(c.subtitle, 'en');
              slide.content.subtitle_sl = getText(c.subtitle, 'sl');
              slide.content.subtitle_hr = getText(c.subtitle, 'hr');

              const ctaText = getText(c.cta, language);
              slide.content.cta.text = ctaText;
              slide.content.cta.visible = !!ctaText;
              slide.content.cta.text_en = getText(c.cta, 'en');
              slide.content.cta.text_sl = getText(c.cta, 'sl');
              slide.content.cta.text_hr = getText(c.cta, 'hr');

              // --- LIST CONTENT LOGIC ---
              if (concept.layout === 'list' && c.listItems && Array.isArray(c.listItems)) {
                  slide.content.listItems = c.listItems.map((item, i) => ({
                      id: `${slide.id}-item-${i}`,
                      title: getText(item.title, language),
                      description: getText(item.description, language)
                  }));
              }

              // --- IMAGE & RESOURCE LOGIC ---
              
              let product: Product | null = null;
              if (concept.searchQuery) {
                  product = await fetchBestProduct(concept.searchQuery, concept.categoryFilter);
              }

              if (product) {
                  const mainImage = product.MainImage || '';
                  const allImages = product.AllImages ? product.AllImages.split(',').map(s => s.trim()).filter(s => s) : [];
                  
                  // Combine them, ensuring Main is first but available
                  const images = [mainImage, ...allImages].filter(Boolean);
                  
                  // Heuristic: Prefer non-white background images for lifestyles (index > 0 usually)
                  // MainImage (index 0) is typically a studio product shot on white.
                  
                  if (concept.layout === 'product') {
                      // Product Layout: Prefer Main Image (Clean)
                      slide.content.grid.images = [mainImage];
                      slide.background.image = mainImage;
                      
                      // Bind Product Info
                      slide.content.productOverlay.visible = true;
                      slide.content.productOverlay.name = product.ItemName;
                      slide.content.productOverlay.price = product.ItemPriceGross_Qty6 || null;
                      slide.content.productOverlay.originalProduct = product;
                      slide.content.link.type = 'product';
                      slide.content.link.url = product.ItemCode;
                  } 
                  else if (concept.layout === 'image-grid') {
                      // Grid: Use multiple images if available
                      slide.content.grid.images = images.slice(0, 4);
                  }
                  else {
                      // Standard/Intro/Brand: Prefer Lifestyle (Non-Main) if available
                      // If only 1 image exists, use it.
                      const lifestyle = allImages.length > 0 ? allImages[0] : mainImage;
                      
                      slide.content.grid.images = [lifestyle];
                      slide.background.image = lifestyle;
                      
                      // Dim background for text readability if it's a full bg slide
                      slide.background.brightness = 40;
                  }
              } else {
                  // No Product Found - Clean up default images if generated concept expects images
                  if (concept.layout === 'image-grid' || concept.layout === 'product') {
                      // Keep placeholders or clear? Let's clear to avoid confusion, user must add images manually.
                      // But keeping defaults is better for 'demo' feel.
                  }
              }

              // Blog Specific Logic
              if (concept.layout === 'blog') {
                   let blog = null;
                   if (concept.blogKeywords) blog = await fetchBestBlog(concept.blogKeywords);
                   
                   if (blog) {
                       slide.content.originalBlogPost = blog;
                       slide.content.heading = blog[`title_${language}` as keyof BlogPostRow] || blog.title_en;
                       // ... (Localization copy for blog) ...
                       if (blog.featured_image_url) slide.content.grid.images = [blog.featured_image_url];
                   } else if (generatedNarrative.generatedBlog) {
                       // Fallback to AI gen content
                       const gb = generatedNarrative.generatedBlog;
                       slide.content.heading = getText(gb.title, language);
                       slide.content.subtitle = getText(gb.excerpt, language);
                   }
              }

              newSlides.push(slide);
          }
          
          const postText = generatedNarrative.postContent 
              ? (generatedNarrative.postContent[language] || generatedNarrative.postContent['en']) 
              : '';

          onApplyNarrative(newSlides, postText);

      } catch (e) {
          console.error("Failed to assemble slides", e);
      } finally {
          setIsGenerating(false);
      }
  };

  return (
    <div className={`flex flex-col h-full bg-surface overflow-y-auto w-80 shrink-0 ${className || ''}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-surfaceHighlight/20 backdrop-blur-md sticky top-0 z-10">
        <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center font-bold text-purple-400 shadow-lg">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">Campaign AI</h1>
          <p className="text-[10px] text-gray-500 font-medium tracking-wide">JAN 2026 EDITION</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Campaign Type Selectors */}
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign Type</label>
                <button 
                    onClick={suggestIdeas}
                    className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                    <Lightbulb size={12} /> Auto-Suggest
                </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {CAMPAIGN_TYPES.map(type => (
                    <button
                        key={type.id}
                        onClick={() => setSelectedCampaign(type.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                            selectedCampaign === type.id 
                            ? 'bg-purple-500/20 border-purple-500 ring-1 ring-purple-500/50' 
                            : 'bg-black/20 border-white/5 hover:bg-white/5'
                        }`}
                    >
                        <div className={`mb-2 ${selectedCampaign === type.id ? 'text-purple-400' : 'text-gray-400'}`}>
                            {type.icon}
                        </div>
                        <div className="text-xs font-bold text-white leading-tight">{type.label}</div>
                    </button>
                ))}
            </div>
        </div>

        {/* Input Area */}
        <div className="space-y-3">
             <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Topic / Focus</label>
             <div className="relative">
                <input 
                    type="text" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateNarrative()}
                    placeholder="e.g. Winter Sale, New Product..."
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
             </div>
             
             <button 
                onClick={handleGenerateNarrative}
                disabled={isGenerating || !topic.trim()}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-purple-900/20 group disabled:opacity-50 disabled:cursor-not-allowed"
             >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="group-hover:animate-pulse" />} 
                {isGenerating ? 'Planning...' : 'Generate Narrative'}
             </button>
        </div>

        {/* Narrative Preview */}
        {generatedNarrative && generatedNarrative.slides && !isGenerating && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-black/20 border border-purple-500/30 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-sm font-bold text-white">{generatedNarrative.title}</h3>
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">
                            {generatedNarrative.slides.length} Slides
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">{generatedNarrative.description}</p>
                    
                    {/* Slide Roadmap */}
                    <div className="space-y-2 relative">
                        <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-white/10"></div>
                        {generatedNarrative.slides.map((slide, idx) => (
                            <div key={idx} className="relative pl-6 flex items-center justify-between group">
                                <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-[#18181b] border-2 border-white/20 group-hover:border-purple-500 transition-colors z-10"></div>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <div className="text-[10px] font-bold text-gray-300 uppercase">{slide.role}</div>
                                        <div className="flex gap-1">
                                            {slide.alignment === 'left' && <AlignLeft size={10} className="text-gray-500" />}
                                            {slide.alignment === 'center' && <AlignCenter size={10} className="text-gray-500" />}
                                            {slide.alignment === 'right' && <AlignRight size={10} className="text-gray-500" />}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-gray-500">{slide.layout}</div>
                                </div>
                                {slide.layout === 'product' && <Zap size={12} className="text-yellow-500" />}
                                {slide.layout === 'brand' && <Megaphone size={12} className="text-pink-500" />}
                                {slide.layout === 'blog' && <Layers size={12} className="text-blue-500" />}
                                {slide.layout === 'list' && <AlignLeft size={12} className="text-green-500" />}
                            </div>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={handleApplyToDeck}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors"
                >
                    <CheckCircle size={16} /> Load Narrative Deck
                </button>
                <p className="text-[10px] text-center text-gray-500">
                    Auto-fetches lifestyle images (non-white corners) where possible.
                </p>
            </div>
        )}
        
        {(!generatedNarrative || !generatedNarrative.slides) && !isGenerating && (
             <div className="p-6 text-center border border-dashed border-white/10 rounded-xl bg-white/5 mt-4">
                 <Layers className="mx-auto text-gray-600 mb-2" size={24} />
                 <p className="text-xs text-gray-500">
                    Select a campaign type and hit auto-suggest to get started with Jan 2026 themes.
                 </p>
             </div>
        )}

      </div>
    </div>
  );
}