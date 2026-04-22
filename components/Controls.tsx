import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Type, Layout, Image as ImageIcon, Palette, Square, Smartphone, Check, Grid, Layers, Hexagon, Maximize, Plus, Copy, Trash2, Film, LayoutGrid, X, Upload, Link as LinkIcon, AlertCircle, Package, MessageSquareText, Tag, SlidersHorizontal, ExternalLink, Globe, ShoppingBag, List, GripVertical, GripHorizontal, RefreshCw, FileText, Search, Sparkles, Loader2, Grid3X3 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, rectSortingStrategy, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GoogleGenAI } from "@google/genai";

import { BannerConfig, FormatType, Position, LayoutType, Product, ListItem, BlogPostRow, Language } from '../types';
import { FORMATS, POSITIONS, ICONS, SITE_PAGES, PRODUCT_CATEGORIES } from '../constants';
import ImageSourceModal from './ImageSourceModal';
import BlogPickerModal from './BlogPickerModal';
import { supabase } from '../supabase';

// Get API Key from environment variable
const GOOGLE_API_KEY = process.env.API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY || '';

interface ControlsProps {
  config: BannerConfig;
  update: (path: string, value: any) => void;
  batchUpdate?: (updates: Record<string, any>) => void; // New prop for atomic updates
  // Slide Management Props
  slides: BannerConfig[];
  activeSlideIndex: number;
  onSlideChange: (index: number) => void;
  onAddSlide: () => void;
  onRemoveSlide: (index: number) => void;
  onDuplicateSlide: (index: number) => void;
  onReorderSlides: (oldIndex: number, newIndex: number) => void;
  // Global Post Text
  postText: string;
  setPostText: (text: string) => void;
  setPostTextTranslations?: (translations: Record<string, string>) => void;
  // View Mode
  view: 'design' | 'content';
  className?: string;
  
  // Language Props (Optional for Design view, required for Content)
  currentLanguage?: Language;
  onLanguageChange?: (lang: Language) => void;
}

interface SortableSlideItemProps {
  key?: React.Key;
  slide: BannerConfig;
  index: number;
  isActive: boolean;
  primaryColor: string;
  onSelect: () => void;
  onRemove: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  showDelete: boolean;
}

// Helper to render thumbnails considering solid colors
const Thumbnail = ({ src, primaryColor }: { src: string; primaryColor: string }) => {
    if (src?.startsWith('color:')) {
        const color = src === 'color:primary' ? primaryColor : src.replace('color:', '');
        return <div className="w-full h-full" style={{ backgroundColor: color }} />;
    }
    return <img src={src} className="w-full h-full object-cover" alt="thumbnail" />;
};

// Sortable Slide Item Component
const SortableSlideItem = ({ 
  slide, 
  index, 
  isActive, 
  primaryColor, 
  onSelect, 
  onRemove, 
  onDuplicate, 
  showDelete 
}: SortableSlideItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  // Determine thumbnail image
  let thumb = slide.background.image;
  // Use first grid image for thumbnail if present (Universal Grid Model)
  if (slide.content.grid.images.length > 0) {
    thumb = slide.content.grid.images[0];
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className="flex-shrink-0 relative group snap-start touch-none"
    >
      <button
        onClick={onSelect}
        className={`w-16 h-16 rounded-lg border-2 overflow-hidden transition-all duration-200 relative ${isActive ? '' : 'opacity-60 hover:opacity-100 border-transparent'}`}
        style={{ 
            borderColor: isActive ? primaryColor : 'transparent'
        }}
      >
        <Thumbnail src={thumb} primaryColor={primaryColor} />
          {slide.layout === 'brand' && (
            <div className="absolute top-1 left-1 bg-black/50 p-0.5 rounded">
              <Hexagon size={8} className="text-white" />
            </div>
          )}
          {slide.layout === 'list' && (
            <div className="absolute top-1 left-1 bg-black/50 p-0.5 rounded">
              <List size={8} className="text-white" />
            </div>
          )}
          {slide.layout === 'blog' && (
            <div className="absolute top-1 left-1 bg-black/50 p-0.5 rounded">
              <FileText size={8} className="text-white" />
            </div>
          )}
          {slide.layout === 'image-grid' && (
            <div className="absolute top-1 left-1 bg-black/50 p-0.5 rounded">
              <Grid3X3 size={8} className="text-white" />
            </div>
          )}
        <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-tl-md font-bold">
            {index + 1}
        </div>
      </button>
      
      {/* Hover Actions - Using onPointerDown to prevent drag start */}
      <div 
        className="absolute -top-2 -right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100 z-10"
        onPointerDown={(e) => e.stopPropagation()} 
      >
        {showDelete && (
            <button 
              onClick={onRemove}
              className="w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center shadow-lg hover:bg-red-500"
            >
              <Trash2 size={10} />
            </button>
        )}
        <button 
            onClick={onDuplicate}
            className="w-5 h-5 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg hover:bg-white"
        >
            <Copy size={10} />
        </button>
      </div>
    </div>
  );
};

interface SortableGridImageProps {
  key?: React.Key;
  url: string;
  onRemove: () => void;
  onReplace: () => void;
  primaryColor: string;
}

// Sortable Grid Image Component
const SortableGridImage = ({ url, onRemove, onReplace, primaryColor }: SortableGridImageProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className="relative group aspect-square rounded-md overflow-hidden border border-white/10 touch-none cursor-grab active:cursor-grabbing hover:border-white/30 transition-colors"
    >
      <Thumbnail src={url} primaryColor={primaryColor} />
      
      {/* Actions Overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none">
          <div className="absolute top-1.5 right-1.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
              {/* Replace Button */}
              <button 
                onClick={onReplace}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-6 h-6 rounded-md bg-black/60 text-white hover:bg-white hover:text-black flex items-center justify-center transition-colors border border-white/20 shadow-sm"
                title="Replace Image"
              >
                <RefreshCw size={12} />
              </button>
              
              {/* Remove Button */}
              <button 
                onClick={onRemove}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-6 h-6 rounded-md bg-black/60 text-white hover:bg-red-500 hover:border-red-500 hover:text-white flex items-center justify-center transition-colors border border-white/20 shadow-sm"
                title="Remove Image"
              >
                <X size={12} />
              </button>
          </div>
      </div>
    </div>
  );
};

interface SortableListItemControlProps {
  key?: React.Key;
  item: ListItem;
  onChange: (i: ListItem) => void;
  onRemove: () => void;
}

// Sortable List Item Component for Controls
const SortableListItemControl = ({ item, onChange, onRemove }: SortableListItemControlProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className="flex gap-2 bg-black/20 p-3 rounded-lg border border-white/5 group items-start"
        >
            <div {...attributes} {...listeners} className="mt-2 text-gray-600 cursor-grab hover:text-gray-400 touch-none">
                <GripVertical size={14} />
            </div>
            <div className="flex-1 space-y-2">
                <input 
                    type="text" 
                    value={item.title}
                    onChange={(e) => onChange({ ...item, title: e.target.value })}
                    placeholder="Title (e.g. 50-99 pcs) - Optional"
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/20 font-bold"
                />
                <input 
                    type="text" 
                    value={item.description}
                    onChange={(e) => onChange({ ...item, description: e.target.value })}
                    placeholder="Description (e.g. -22% off)"
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/20"
                />
            </div>
            <button onClick={onRemove} className="mt-2 text-gray-600 hover:text-red-400">
                <X size={14} />
            </button>
        </div>
    );
};


// Sub-components for cleaner file structure
const Section = ({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children?: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 bg-surface/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400">{icon}</span>
          <span className="text-sm font-semibold uppercase tracking-wider text-gray-200">{title}</span>
        </div>
        <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">{children}</div>}
    </div>
  );
};

const PositionGrid = ({ value, onChange, primary }: { value: Position; onChange: (v: Position) => void; primary: string }) => (
  <div className="grid grid-cols-3 gap-1 p-1 bg-black/20 rounded-lg w-max border border-white/5">
    {POSITIONS.map((pos) => (
      <button
        key={pos}
        onClick={() => onChange(pos as Position)}
        className={`w-8 h-8 rounded transition-all duration-200 ${value === pos ? 'scale-110 shadow-lg' : 'hover:bg-white/10'}`}
        style={{ backgroundColor: value === pos ? primary : 'rgba(255,255,255,0.05)' }}
        aria-label={pos}
      />
    ))}
  </div>
);

const Input = ({ label, value, onChange, placeholder, textarea = false }: { label?: string; value: string; onChange: (val: string) => void; placeholder?: string; textarea?: boolean }) => (
  <div className="space-y-1.5">
    {label && <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">{label}</label>}
    {textarea ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors resize-none"
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors"
      />
    )}
  </div>
);

const Toggle = ({ label, checked, onChange, primary }: { label: string; checked: boolean; onChange: (v: boolean) => void; primary: string }) => (
  <div className="flex items-center justify-between cursor-pointer group" onClick={() => onChange(!checked)}>
    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
    <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${checked ? '' : 'bg-white/10'}`} style={{ backgroundColor: checked ? primary : undefined }}>
      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 shadow-sm ${checked ? 'left-6' : 'left-1'}`} />
    </div>
  </div>
);

const LayoutCard = ({ type, current, onClick, icon, label, primary }: { type: LayoutType, current: LayoutType, onClick: () => void, icon: React.ReactNode, label: string, primary: string }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 gap-2 ${current === type ? 'bg-white/5 border-transparent' : 'bg-transparent border-white/10 hover:bg-white/5'}`}
    style={{ borderColor: current === type ? primary : undefined }}
  >
    <div style={{ color: current === type ? primary : 'gray' }}>{icon}</div>
    <span className="text-xs font-medium text-white">{label}</span>
  </button>
);

// Helper to strip HTML tags
const stripHtml = (html: string) => {
   const tmp = document.createElement("DIV");
   tmp.innerHTML = html;
   return tmp.textContent || tmp.innerText || "";
};

// URL Encoding helper
const encode = (str: string) => {
    return encodeURIComponent(str).replace(/%20/g, '+');
};

export default function Controls(props: ControlsProps) {
  const { config, update, batchUpdate, slides, activeSlideIndex, onSlideChange, onAddSlide, onRemoveSlide, onDuplicateSlide, onReorderSlides, postText, setPostText, setPostTextTranslations, view, className, currentLanguage, onLanguageChange } = props;
  const { primaryColor } = config.theme;

  // Custom Image State
  const [customImages, setCustomImages] = useState<string[]>([]);
  
  // New Image Source Modal State
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageModalMode, setImageModalMode] = useState<'add-grid' | 'replace-grid' | 'background'>('add-grid');
  const [replaceTargetIndex, setReplaceTargetIndex] = useState<number>(-1);

  // Blog Picker Modal State
  const [showBlogModal, setShowBlogModal] = useState(false);

  // Auto Translate State
  const [isTranslating, setIsTranslating] = useState(false);
  const aiRef = useRef<GoogleGenAI | null>(null);

  // Initialize GenAI
  if (!aiRef.current && GOOGLE_API_KEY) {
    aiRef.current = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  }

  // Link Section Local State
  const [linkTab, setLinkTab] = useState<'category' | 'page' | 'custom'>(
      config.content.link.type === 'category' ? 'category' : 
      config.content.link.type === 'product' || config.content.link.type === 'custom' ? 'custom' : 'page'
  );
  
  // Parse category/subcategory from URL if it exists
  const parseCategoryFromUrl = (url: string) => {
      if (!url) return { main: '', sub: '' };
      const parts = url.split('&subcategory=');
      return {
          main: parts[0],
          sub: parts[1] || ''
      };
  };

  const initialCats = config.content.link.type === 'category' ? parseCategoryFromUrl(config.content.link.url) : { main: '', sub: '' };
  const [selectedMainCat, setSelectedMainCat] = useState(initialCats.main);
  const [selectedSubCat, setSelectedSubCat] = useState(initialCats.sub);

  // Category Data State
  const [allMainCategories, setAllMainCategories] = useState<string[]>([]);
  const [categoryTree, setCategoryTree] = useState<Record<string, string[]>>({});

  // Localized placeholders
  const lang = currentLanguage || config.content.link.language || 'en';
  const placeholders = {
      en: { pricePrefix: 'Price from', cta: 'Button Text', title: 'Headline', sub: 'Subtitle', desc: 'Description' },
      sl: { pricePrefix: 'Cena od', cta: 'Besedilo gumba', title: 'Naslov', sub: 'Podnaslov', desc: 'Opis' },
      hr: { pricePrefix: 'Cijena od', cta: 'Tekst gumba', title: 'Naslov', sub: 'Podnaslov', desc: 'Opis' }
  };
  const t = placeholders[lang] || placeholders.en;

  // Fetch Categories - Tree Builder logic
  useEffect(() => {
     const fetchTree = async () => {
         try {
             const { data } = await supabase
                .from('XD')
                .select('MainCategory, SubCategory')
                .neq('IsDiscontinued', true)
                .neq('MainCategory', '')
                .not('MainCategory', 'is', null)
                .limit(20000); 
             
             if (data) {
                 const tree: Record<string, string[]> = {};
                 
                 data.forEach((item: any) => {
                     const main = item.MainCategory?.trim();
                     const sub = item.SubCategory?.trim();
                     
                     if (main && main !== 'Category') {
                         if (!tree[main]) tree[main] = [];
                         if (sub && !tree[main].includes(sub)) tree[main].push(sub);
                     }
                 });

                 setCategoryTree(tree);
                 setAllMainCategories(Object.keys(tree).sort());
             }
         } catch (e) {
              console.error("Error fetching categories", e);
         }
      };
      fetchTree();
  }, []);

  // Derive Available Subcategories from Tree
  const availableSubCategories = useMemo(() => {
      if (!selectedMainCat) return [];
      return (categoryTree[selectedMainCat] || []).sort();
  }, [selectedMainCat, categoryTree]);

  // Combine DB categories with Constants for robustness
  const categoryList = useMemo(() => {
      const combined = new Set([...allMainCategories, ...PRODUCT_CATEGORIES]);
      return Array.from(combined).filter(c => c && c.trim() !== '').sort();
  }, [allMainCategories]);

  // Update local state when slide changes
  useEffect(() => {
     const newLinkType = config.content.link.type;
     if (newLinkType === 'category') {
         setLinkTab('category');
         const { main, sub } = parseCategoryFromUrl(config.content.link.url);
         setSelectedMainCat(main);
         setSelectedSubCat(sub);
     } else if (newLinkType === 'homepage' || newLinkType === 'page') {
         setLinkTab('page'); 
     } else {
         setLinkTab('custom');
     }
  }, [config.id, config.content.link.type, config.content.link.url]);

  // Load custom images from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('socialframe_custom_images');
    if (saved) {
      try {
        setCustomImages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load images", e);
      }
    }
  }, []);

  // Save custom images to localStorage
  const saveImages = (images: string[]) => {
    setCustomImages(images);
    try {
      localStorage.setItem('socialframe_custom_images', JSON.stringify(images));
    } catch (e) {
      console.warn("Storage quota exceeded", e);
    }
  };

  // --- Auto Translate Logic ---
  const handleAutoTranslate = async () => {
      if (isTranslating || !aiRef.current) return;
      setIsTranslating(true);

      const heading = config.content.heading;
      const subtitle = config.content.subtitle;
      const cta = config.content.cta.text;
      const prefix = config.content.productOverlay.pricePrefix;
      const listItems = config.content.listItems;
      const currentPostText = postText;

      // Basic validation: ensure there is something to translate
      if (!heading && !subtitle && !cta && !currentPostText && (!listItems || listItems.length === 0)) {
          setIsTranslating(false);
          return;
      }

      try {
          const prompt = `
            Translate the following social media text contents from "${currentLanguage || 'auto'}" to: English (en), Slovenian (sl), and Croatian (hr).
            
            Input:
            Heading: "${heading}"
            Subtitle: "${subtitle}"
            Button (CTA): "${cta}"
            Price Prefix: "${prefix}"
            Post Content (LinkedIn/FB): "${currentPostText}"
            List Items: ${JSON.stringify(listItems.map(i => ({ id: i.id, title: i.title, description: i.description })))}
            
            Return ONLY valid JSON in this specific structure:
            {
              "en": { 
                  "heading": "...", "subtitle": "...", "cta": "...", "prefix": "...", "postText": "...",
                  "listItems": [ { "id": "...", "title": "...", "description": "..." } ] 
              },
              "sl": { 
                  "heading": "...", "subtitle": "...", "cta": "...", "prefix": "...", "postText": "...",
                  "listItems": [ { "id": "...", "title": "...", "description": "..." } ]
              },
              "hr": { 
                  "heading": "...", "subtitle": "...", "cta": "...", "prefix": "...", "postText": "...",
                  "listItems": [ { "id": "...", "title": "...", "description": "..." } ]
              }
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
              
              const updates: Record<string, any> = {};
              const postTextUpdates: Record<string, string> = { en: '', sl: '', hr: '' };

              // Build current list items structure to preserve IDs and existing data
              const currentListItems = [...(config.content.listItems || [])];

              // Map API response to our schema
              ['en', 'sl', 'hr'].forEach((lang) => {
                  if (data[lang]) {
                      // Standard fields
                      updates[`content.heading_${lang}`] = data[lang].heading || '';
                      updates[`content.subtitle_${lang}`] = data[lang].subtitle || '';
                      updates[`content.cta.text_${lang}`] = data[lang].cta || '';
                      updates[`content.productOverlay.pricePrefix_${lang}`] = data[lang].prefix || '';
                      
                      // Post Text
                      postTextUpdates[lang] = data[lang].postText || '';

                      // List Items (Match by ID or Index)
                      if (data[lang].listItems && Array.isArray(data[lang].listItems)) {
                          data[lang].listItems.forEach((translatedItem: any, idx: number) => {
                              // Find matching item in currentListItems
                              if (idx < currentListItems.length) {
                                  // We update the item object directly in the array for batch processing later
                                  // Note: This relies on valid object references. 
                                  // For simplicity, we are going to store translations in the item object itself
                                  // The `types` definition supports `title_en`, `title_sl`, etc.
                                  const targetItem = currentListItems[idx];
                                  if (targetItem) {
                                      (targetItem as any)[`title_${lang}`] = translatedItem.title;
                                      (targetItem as any)[`description_${lang}`] = translatedItem.description;
                                  }
                              }
                          });
                      }
                  }
              });
              
              // Apply List Items updates
              updates['content.listItems'] = currentListItems;

              // Apply batch update for slide content
              if (batchUpdate) {
                  batchUpdate(updates);
              } else {
                  Object.entries(updates).forEach(([key, val]) => update(key, val));
              }
              
              // Apply Post Text updates via prop
              if (setPostTextTranslations) {
                  setPostTextTranslations(postTextUpdates);
                  // Also update current view if we are viewing one of the target languages
                  if (currentLanguage && postTextUpdates[currentLanguage]) {
                      setPostText(postTextUpdates[currentLanguage]);
                  }
              }
          }

      } catch (e) {
          console.error("Auto Translate Failed:", e);
          alert("Translation failed. Please try again.");
      } finally {
          setIsTranslating(false);
      }
  };

  const handleImageModalSelect = (urls: string | string[], product?: Product) => {
      const urlList = Array.isArray(urls) ? urls : [urls];
      
      // 1. Add to custom images (history)
      saveImages([...urlList, ...customImages]);
      
      // 2. Add to Grid/Universal Images
      // In this new model, everything goes to content.grid.images
      if (imageModalMode === 'add-grid') {
          const currentImages = config.content.grid.images || [];
          // Filter duplicates to fix sorting/key issues in Grid
          const newUnique = urlList.filter(u => !currentImages.includes(u));
          update('content.grid.images', [...currentImages, ...newUnique]);
      } else if (imageModalMode === 'replace-grid' && replaceTargetIndex !== -1) {
          const currentImages = [...(config.content.grid.images || [])];
          if (replaceTargetIndex < currentImages.length && urlList.length > 0) {
              currentImages[replaceTargetIndex] = urlList[0];
              update('content.grid.images', currentImages);
          }
      }

      // 3. Apply Product Metadata if a new product was selected
      if (product) {
         handleImageSelect(urlList, product);
      }
  };

  const openReplaceGridImage = (index: number) => {
      setReplaceTargetIndex(index);
      setImageModalMode('replace-grid');
      setShowImageModal(true);
  };

  const openAddGridImage = () => {
      setImageModalMode('add-grid');
      setShowImageModal(true);
  };

  const handleImageSelect = (inputImages: string | string[], product?: Product) => {
    // Only proceed with metadata updates if product is provided AND layout is 'product'
    // The image itself is already handled in handleImageModalSelect
    
    if (product && config.layout === 'product') {
        const lang = currentLanguage || 'en';
        
        // Populate display values based on current language
        // Also populate the suffix fields for ALL languages at once
        
        // 1. Prepare data
        const names = {
            en: product.ItemName,
            sl: product.ItemName_sl || product.ItemName,
            hr: product.ItemName_hr || product.ItemName
        };
        
        const descriptions = {
            en: product.LongDescription || '',
            sl: product.LongDescription_sl || product.LongDescription || '',
            hr: product.LongDescription_hr || product.LongDescription || ''
        };

        // 2. Helper to clean/shorten
        const processDesc = (d: string) => {
            const clean = stripHtml(d);
            const first = clean.split('.')[0];
            if (first.length > 10 && first.length < 80) return first + '.';
            return clean.length > 60 ? clean.substring(0, 60).trim() + '...' : clean;
        };

        const subtitles = {
            en: processDesc(descriptions.en),
            sl: processDesc(descriptions.sl),
            hr: processDesc(descriptions.hr)
        };

        const updates: Record<string, any> = {};

        // 3. Update Display Fields
        updates['content.productOverlay.name'] = names[lang];
        updates['content.heading'] = names[lang];
        updates['content.subtitle'] = subtitles[lang];
        
        // 4. Update Storage Fields (Suffixes)
        updates['content.heading_en'] = names.en;
        updates['content.heading_sl'] = names.sl;
        updates['content.heading_hr'] = names.hr;
        
        updates['content.subtitle_en'] = subtitles.en;
        updates['content.subtitle_sl'] = subtitles.sl;
        updates['content.subtitle_hr'] = subtitles.hr;
        
        updates['content.productOverlay.originalProduct'] = product;

        if (product.ItemPriceGross_Qty6) {
             updates['content.productOverlay.price'] = product.ItemPriceGross_Qty6;
        }
        
        updates['content.productOverlay.visible'] = true;
        
        updates['content.link.type'] = 'product';
        updates['content.link.url'] = product.ItemCode; 
        
        if (batchUpdate) {
            batchUpdate(updates);
        } else {
            Object.entries(updates).forEach(([key, val]) => update(key, val));
        }
        
        setLinkTab('custom'); 
    }
  };

  const removeGridImage = (imageToRemove: string) => {
    // Remove specific image by filtering
    const newImages = config.content.grid.images.filter(img => img !== imageToRemove);
    update('content.grid.images', newImages);
  };

  // Category Logic Update
  const handleCategoryChange = (main: string, sub: string) => {
      setSelectedMainCat(main);
      setSelectedSubCat(sub);
      
      let finalUrl = main;
      if (sub) {
          finalUrl = `${main}&subcategory=${sub}`;
      }
      
      update('content.link.type', 'category');
      update('content.link.url', finalUrl);
  };

  // List Item Management
  const handleListItemChange = (index: number, newItem: ListItem) => {
      const newItems = [...(config.content.listItems || [])];
      newItems[index] = newItem;
      update('content.listItems', newItems);
  };

  const handleListItemRemove = (index: number) => {
      const newItems = [...(config.content.listItems || [])];
      newItems.splice(index, 1);
      update('content.listItems', newItems);
  };

  const handleListItemAdd = () => {
      const newItems = [...(config.content.listItems || [])];
      newItems.push({ id: Math.random().toString(36).substr(2, 9), title: '', description: 'New feature' });
      update('content.listItems', newItems);
  };

  const handleListItemDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      
      const oldIndex = (config.content.listItems || []).findIndex(i => i.id === active.id);
      const newIndex = (config.content.listItems || []).findIndex(i => i.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
          const newItems = arrayMove(config.content.listItems, oldIndex, newIndex);
          update('content.listItems', newItems);
      }
  };
  
  // Blog Post Selection Handler
  const handleBlogSelect = (post: BlogPostRow) => {
      const lang = currentLanguage || 'en';
      
      const updates: Record<string, any> = {};

      // 1. Prepare data for all langs
      const titles = {
          en: post.title_en,
          sl: post.title_sl || post.title_en,
          hr: post.title_hr || post.title_en
      };
      
      const excerpts = {
          en: post.excerpt_en,
          sl: post.excerpt_sl || post.excerpt_en,
          hr: post.excerpt_hr || post.excerpt_en
      };

      // 2. Update Display
      updates['content.heading'] = titles[lang];
      updates['content.subtitle'] = excerpts[lang] || '';
      
      // 3. Update Storage
      updates['content.heading_en'] = titles.en;
      updates['content.heading_sl'] = titles.sl;
      updates['content.heading_hr'] = titles.hr;
      
      updates['content.subtitle_en'] = excerpts.en;
      updates['content.subtitle_sl'] = excerpts.sl;
      updates['content.subtitle_hr'] = excerpts.hr;
      
      // Update image if available
      if (post.featured_image_url) {
          updates['content.grid.images'] = [post.featured_image_url];
      }
      
      // Update link
      updates['content.link.type'] = 'blog';
      updates['content.link.url'] = post.slug_en; 
      
      // Save full object for re-localization (legacy support)
      updates['content.originalBlogPost'] = post;

      if (batchUpdate) {
          batchUpdate(updates);
      } else {
          Object.entries(updates).forEach(([key, val]) => update(key, val));
      }
  };

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts to allow clicking
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      const oldIndex = slides.findIndex((s) => s.id === active.id);
      const newIndex = slides.findIndex((s) => s.id === over?.id);
      
      onReorderSlides(oldIndex, newIndex);
    }
  };

  const handleGridImageDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      
      const oldIndex = config.content.grid.images.indexOf(active.id as string);
      const newIndex = config.content.grid.images.indexOf(over.id as string);
      
      if (oldIndex !== -1 && newIndex !== -1) {
          const newImages = arrayMove(config.content.grid.images, oldIndex, newIndex);
          update('content.grid.images', newImages);
      }
  };

  // Helper for Generated Link Preview
  const getGeneratedLink = () => {
     const { type, url, language: linkLang } = config.content.link || { type: 'homepage', url: '', language: 'en' };
     // Use the global currentLanguage if available, otherwise fallback to link config
     const lang = currentLanguage || linkLang || 'en';
     
     const baseUrl = "https://toastagift.com/#";
     const prefix = lang === 'en' ? '' : `/${lang}`;
     
     if (type === 'homepage') {
         const homePath = lang === 'en' ? '/' : prefix;
         return `${baseUrl}${homePath}`;
     }
     
     if (type === 'product') {
         let path = 'product';
         if (lang === 'sl') path = 'izdelek';
         if (lang === 'hr') path = 'proizvod';
         return `${baseUrl}${prefix}/${path}/${url || '{ItemCode}'}`;
     }
     
     if (type === 'category') {
         const catBase = lang === 'en' ? '/' : prefix;
         const parts = (url || '').split('&subcategory=');
         const main = parts[0];
         const sub = parts[1];
         let link = `${baseUrl}${catBase}?category=${encode(main)}`;
         if (sub) link += `&subcategory=${encode(sub)}`;
         return link;
     }
     
     if (type === 'page') {
         const pageObj = SITE_PAGES.find(p => p.id === url);
         if (pageObj) {
             const localizedPath = pageObj[lang as keyof typeof pageObj];
             return `${baseUrl}${localizedPath}`;
         }
         const safeUrl = url.startsWith('/') ? url : `/${url}`;
         return `${baseUrl}${prefix}${safeUrl}`;
     }
     
     if (type === 'blog') {
         let blogPath = '/blog/';
         if (lang === 'sl') blogPath = '/sl/blog/';
         if (lang === 'hr') blogPath = '/hr/blog/';
         return `${baseUrl}${blogPath}${url}`;
     }
     
     if (url.startsWith('http')) return url;
     return `${baseUrl}${prefix}/${url}`;
  };

  return (
    <div className={`flex flex-col h-full bg-surface overflow-y-auto w-80 shrink-0 ${className || ''}`}>
      {/* Design View Components */}
      {view === 'design' && (
      <>
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-surfaceHighlight/20 backdrop-blur-md sticky top-0 z-10">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)` }}
            >
              S
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">SocialFrame</h1>
              <p className="text-[10px] text-gray-500 font-medium tracking-wide">DESIGN SYSTEM</p>
            </div>
          </div>

          {/* Slide Manager - Structural Design */}
          <div className="p-4 border-b border-white/5 bg-black/10">
             <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                   <Film size={12} /> Slides ({slides.length})
                </h3>
                <button 
                   onClick={onAddSlide} 
                   className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors" 
                   title="Add New Slide"
                >
                   <Plus size={16} />
                </button>
             </div>
             
             <div className="flex gap-2 overflow-x-auto pt-3 pb-2 scrollbar-hide snap-x">
               <DndContext 
                  sensors={sensors} 
                  collisionDetection={closestCenter} 
                  onDragEnd={handleDragEnd}
                  id="slides-dnd"
               >
                  <SortableContext 
                    items={slides.map(s => s.id)} 
                    strategy={horizontalListSortingStrategy}
                  >
                    {slides.map((slide, index) => (
                        <SortableSlideItem 
                            key={slide.id}
                            slide={slide}
                            index={index}
                            isActive={index === activeSlideIndex}
                            primaryColor={primaryColor}
                            onSelect={() => onSlideChange(index)}
                            onRemove={(e) => { e.stopPropagation(); onRemoveSlide(index); }}
                            onDuplicate={(e) => { e.stopPropagation(); onDuplicateSlide(index); }}
                            showDelete={slides.length > 1}
                        />
                    ))}
                  </SortableContext>
               </DndContext>
             </div>
          </div>

          {/* Sections */}
          <Section title="Format & Layout" icon={<Layout size={16} />} defaultOpen={true}>
            <div className="space-y-4">
              {/* Format Selector */}
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(FORMATS).map(([key, fmt]) => (
                  <button
                    key={key}
                    onClick={() => update('format', key)}
                    className={`
                      flex items-center gap-3 p-2 rounded-lg transition-all duration-200 border
                      ${config.format === key ? 'bg-white/5 border-transparent' : 'bg-transparent border-white/10 hover:border-white/20 hover:bg-white/5'}
                    `}
                    style={{ borderColor: config.format === key ? primaryColor : undefined }}
                  >
                    {key === 'square' ? <Square size={16} className="text-gray-300" /> : <Smartphone size={16} className="text-gray-300" />}
                    <div className="text-left">
                       <span className="text-xs font-semibold text-white block">{fmt.label}</span>
                       <span className="text-[10px] text-gray-500">{fmt.ratio}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="border-t border-white/5 my-2"></div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1 block mb-2">Content Type</label>

              {/* Layout Mode Selector - Simplified */}
              <div className="grid grid-cols-2 gap-2">
                 <LayoutCard 
                    type="standard" 
                    current={config.layout === 'image' || config.layout === 'grid' ? 'standard' : config.layout} 
                    onClick={() => {
                        update('layout', 'standard');
                        update('content.productOverlay.visible', false);
                    }} 
                    icon={<Layers size={20} />} 
                    label="Standard" 
                    primary={primaryColor}
                 />
                 <LayoutCard 
                    type="image-grid" 
                    current={config.layout} 
                    onClick={() => {
                        update('layout', 'image-grid');
                        update('content.productOverlay.visible', false);
                    }} 
                    icon={<Grid3X3 size={20} />} 
                    label="Image Grid" 
                    primary={primaryColor}
                 />
                 <LayoutCard 
                    type="product" 
                    current={config.layout} 
                    onClick={() => {
                        update('layout', 'product');
                        // Ensure overlay info is visible in config logic, though we render it differently
                        update('content.productOverlay.visible', true); 
                    }} 
                    icon={<ShoppingBag size={20} />} 
                    label="Product" 
                    primary={primaryColor}
                 />
                 <LayoutCard 
                    type="list" 
                    current={config.layout} 
                    onClick={() => {
                        update('layout', 'list');
                        update('content.productOverlay.visible', false);
                    }} 
                    icon={<List size={20} />} 
                    label="List" 
                    primary={primaryColor}
                 />
                 <LayoutCard 
                    type="brand" 
                    current={config.layout} 
                    onClick={() => {
                        update('layout', 'brand');
                        update('content.productOverlay.visible', false);
                    }} 
                    icon={<Hexagon size={20} />} 
                    label="Brand" 
                    primary={primaryColor}
                 />
                 <LayoutCard 
                    type="blog" 
                    current={config.layout} 
                    onClick={() => {
                        update('layout', 'blog');
                        update('content.productOverlay.visible', false);
                    }} 
                    icon={<FileText size={20} />} 
                    label="Blog" 
                    primary={primaryColor}
                 />
              </div>
            </div>
          </Section>

          {config.layout !== 'brand' && config.layout !== 'image-grid' && (
            <Section title="Position" icon={<Grid size={16} />}>
              <div className="flex items-center gap-6">
                <PositionGrid value={config.position} onChange={(v) => update('position', v)} primary={primaryColor} />
                <div className="flex-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Alignment</span>
                  <p className="text-sm text-white capitalize">{config.position.replace('-', ' ')}</p>
                </div>
              </div>
            </Section>
          )}

           <Section title="Theme Colors" icon={<Palette size={16} />}>
              <div className="space-y-6">
                 {/* Branding Control - Only for Brand Layout */}
                 {config.layout === 'brand' && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">Branding Size</label>
                      <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-3">
                          <div className="flex items-center gap-3">
                              <Maximize size={14} className="text-gray-500" />
                              <input
                                  type="range"
                                  min={20}
                                  max={100}
                                  value={config.content.logo.size}
                                  onChange={(e) => update('content.logo.size', parseInt(e.target.value))}
                                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                              />
                          </div>
                      </div>
                    </div>
                 )}

                 {(config.layout === 'standard' || config.layout === 'list' || config.layout === 'blog') && (
                 <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Accent Icon</label>
                    <div className="flex flex-wrap gap-2">
                       {Object.entries(ICONS).map(([key, icon]) => (
                          <button
                             key={key}
                             onClick={() => update('content.icon', key)}
                             title={key === 'logo' ? 'Use Brand Logo' : key}
                             className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 border ${
                                config.content.icon === key ? 'bg-white/10 border-transparent' : 'bg-transparent border-white/10 hover:bg-white/5'
                             }`}
                             style={{ color: config.content.icon === key ? primaryColor : 'rgba(255,255,255,0.4)', borderColor: config.content.icon === key ? primaryColor : undefined }}
                          >
                             {icon ? <div className="w-5 h-5">{icon}</div> : <span className="text-lg">∅</span>}
                          </button>
                       ))}
                    </div>
                 </div>
                 )}

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Primary Color</label>
                       <div className="flex items-center gap-3 p-2 bg-black/20 rounded-lg border border-white/5">
                          <div className="w-8 h-8 rounded-md overflow-hidden relative border border-white/10">
                             <input 
                                type="color" 
                                value={config.theme.primaryColor} 
                                onChange={(e) => update('theme.primaryColor', e.target.value)}
                                className="absolute inset-[-4px] w-[150%] h-[150%] p-0 cursor-pointer border-0"
                             />
                          </div>
                          <span className="text-xs font-mono text-gray-400">{config.theme.primaryColor}</span>
                       </div>
                    </div>
                    <div>
                       <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Text Color</label>
                       <div className="flex items-center gap-3 p-2 bg-black/20 rounded-lg border border-white/5">
                          <div className="w-8 h-8 rounded-md overflow-hidden relative border border-white/10">
                             <input 
                                type="color" 
                                value={config.theme.textColor} 
                                onChange={(e) => update('theme.textColor', e.target.value)}
                                className="absolute inset-[-4px] w-[150%] h-[150%] p-0 cursor-pointer border-0"
                             />
                          </div>
                          <span className="text-xs font-mono text-gray-400">{config.theme.textColor}</span>
                       </div>
                    </div>
                 </div>
              </div>
           </Section>
      </>
      )}

      {/* Content View Components */}
      {view === 'content' && (
      <>
        {/* Content Header & Language Switcher */}
        <div className="p-4 border-b border-white/5 bg-surfaceHighlight/20 backdrop-blur-md sticky top-0 z-10 flex flex-col gap-3">
             <div className="flex items-center justify-between">
                 <h2 className="text-sm font-bold text-white uppercase tracking-wider">Content Editor</h2>
                 <div className="flex gap-2">
                     {/* Auto Translate Button */}
                     <button
                        onClick={handleAutoTranslate}
                        disabled={isTranslating}
                        title="Auto-translate current text to all languages"
                        className={`p-1.5 rounded-lg border transition-all ${isTranslating ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                     >
                        {isTranslating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                     </button>
                     
                     <div className="flex gap-1 bg-black/40 p-1 rounded-lg">
                         {(['en', 'sl', 'hr'] as Language[]).map(lang => (
                             <button
                                key={lang}
                                onClick={() => onLanguageChange?.(lang)}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                                    currentLanguage === lang 
                                    ? 'bg-primary text-white shadow-sm' 
                                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                                }`}
                             >
                                 {lang}
                             </button>
                         ))}
                     </div>
                 </div>
             </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pb-20"> 
        
        {/* Images Section */}
        <Section title="Images" icon={<ImageIcon size={16} />} defaultOpen={true}>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">Visuals ({config.content.grid.images.length})</label>
                    <span className="text-[10px] text-gray-500">Drag to reorder</span>
                </div>
                
                <DndContext 
                    id="grid-images-dnd"
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragEnd={handleGridImageDragEnd}
                >
                    <SortableContext items={config.content.grid.images} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-4 gap-2">
                          {config.content.grid.images.map((img, index) => (
                            <SortableGridImage 
                                key={img} 
                                url={img} 
                                onRemove={() => removeGridImage(img)} 
                                onReplace={() => openReplaceGridImage(index)}
                                primaryColor={primaryColor}
                            />
                          ))}
                          <button 
                             onClick={openAddGridImage}
                             className="aspect-square rounded-md border border-dashed border-white/20 flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-white/40 transition-colors p-1"
                          >
                             <Plus size={16} className="mb-1" />
                             <span className="text-[10px]">Add</span>
                          </button>
                        </div>
                    </SortableContext>
                </DndContext>
              </div>

              {/* Dimming/Brightness Control - always available */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Overlay Opacity</span>
                    <span>{100 - config.background.brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    // Reverse the logic: slider 0 = 100 brightness (no overlay), slider 100 = 0 brightness (full overlay)
                    value={100 - config.background.brightness}
                    onChange={(e) => update('background.brightness', 100 - parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  />
                  <p className="text-[10px] text-gray-500">Set to 0% to remove gradient and dimming.</p>
               </div>

               {/* Gap Size - Show if > 1 image */}
               {config.content.grid.images.length > 1 && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                     <div className="flex justify-between text-xs text-gray-400">
                        <span>Grid Gap</span>
                        <span>{config.content.grid.gap}px</span>
                     </div>
                     <input
                        type="range"
                        min={0}
                        max={100}
                        value={config.content.grid.gap}
                        onChange={(e) => update('content.grid.gap', parseInt(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                     />
                  </div>
               )}
            </div>
       </Section>
        
        <Section title="Post & Link" icon={<MessageSquareText size={16} />} defaultOpen={true}>
           <div className="space-y-4">
               <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">LinkedIn Post Text</label>
                   <textarea
                        value={postText}
                        onChange={(e) => setPostText(e.target.value)}
                        placeholder="Write your LinkedIn post content here..."
                        rows={4}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors resize-none"
                   />
               </div>

               <div className="pt-2 border-t border-white/5">
                   <div className="flex justify-between items-center mb-3">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Target Link</label>
                   </div>
                   
                   {/* Link Type Tabs */}
                   <div className="flex gap-2 mb-4">
                       <button
                           onClick={() => setLinkTab('category')}
                           className={`flex-1 py-2 px-1 rounded-md text-[10px] md:text-xs font-bold transition-all border ${
                               linkTab === 'category' 
                               ? 'bg-white/10 border-primary text-white' 
                               : 'bg-transparent border-white/10 text-gray-500 hover:text-white'
                           }`}
                           style={{ borderColor: linkTab === 'category' ? primaryColor : undefined }}
                       >
                           KATEGORIJA
                       </button>
                       <button
                           onClick={() => setLinkTab('page')}
                           className={`flex-1 py-2 px-1 rounded-md text-[10px] md:text-xs font-bold transition-all border ${
                               linkTab === 'page' 
                               ? 'bg-white/10 border-primary text-white' 
                               : 'bg-transparent border-white/10 text-gray-500 hover:text-white'
                           }`}
                           style={{ borderColor: linkTab === 'page' ? primaryColor : undefined }}
                       >
                           STRAN
                       </button>
                       <button
                           onClick={() => setLinkTab('custom')}
                           className={`flex-1 py-2 px-1 rounded-md text-[10px] md:text-xs font-bold transition-all border ${
                               linkTab === 'custom' 
                               ? 'bg-white/10 border-primary text-white' 
                               : 'bg-transparent border-white/10 text-gray-500 hover:text-white'
                           }`}
                           style={{ borderColor: linkTab === 'custom' ? primaryColor : undefined }}
                       >
                           CUSTOM
                       </button>
                   </div>
                   
                   {/* Category Selection */}
                   {linkTab === 'category' && (
                       <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                           <select
                                value={selectedMainCat}
                                onChange={(e) => handleCategoryChange(e.target.value, '')}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20"
                           >
                                <option value="" className="bg-[#18181b] text-white text-gray-500">Select Main Category</option>
                                {categoryList.map(cat => (
                                    <option key={cat} value={cat} className="bg-[#18181b] text-white">{cat}</option>
                                ))}
                           </select>

                           <div className="relative">
                                <select
                                    value={selectedSubCat}
                                    onChange={(e) => handleCategoryChange(selectedMainCat, e.target.value)}
                                    disabled={!selectedMainCat || availableSubCategories.length === 0}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 appearance-none disabled:opacity-50"
                                >
                                    <option value="" className="bg-[#18181b] text-white">{availableSubCategories.length === 0 ? 'No Subcategories' : 'Select Subcategory'}</option>
                                    {availableSubCategories.map(sub => (
                                        <option key={sub} value={sub} className="bg-[#18181b] text-white">{sub}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                    <ChevronDown size={14} />
                                </div>
                           </div>
                           
                           <p className="text-[10px] text-gray-500">Note: Categories link to the English ID but show in selected language.</p>
                       </div>
                   )}

                   {/* Page Selection */}
                   {linkTab === 'page' && (
                       <div className="animate-in fade-in slide-in-from-top-1">
                            <select
                                value={config.content.link.type === 'page' ? config.content.link.url : ''}
                                onChange={(e) => {
                                    const pageId = e.target.value;
                                    if (!pageId) return;
                                    
                                    if (pageId === 'home') {
                                        update('content.link.type', 'homepage');
                                        update('content.link.url', '');
                                    } else {
                                        update('content.link.type', 'page');
                                        update('content.link.url', pageId);
                                    }
                                }}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20"
                           >
                                <option value="" className="bg-[#18181b] text-white">Select a Page</option>
                                {SITE_PAGES.map(page => (
                                    <option key={page.id} value={page.id} className="bg-[#18181b] text-white">{page.label}</option>
                                ))}
                           </select>
                       </div>
                   )}

                   {/* Custom Input */}
                   {linkTab === 'custom' && (
                       <div className="animate-in fade-in slide-in-from-top-1 space-y-2">
                           <Input 
                                value={config.content.link?.url || ''} 
                                onChange={(v) => {
                                    // Detect if it looks like a product code (simple alphanumeric, no http)
                                    const isUrl = v.includes('http') || v.includes('www') || v.includes('/');
                                    update('content.link.type', isUrl ? 'custom' : 'product');
                                    update('content.link.url', v);
                                }} 
                                placeholder="Full URL or Product Item Code"
                           />
                           <p className="text-[10px] text-gray-500">Type an Item Code (e.g. P432.001) to link to a product, or a full URL.</p>
                       </div>
                   )}
                   
                   {/* Preview Box */}
                   <div className="mt-3 text-[10px] text-gray-500 font-mono bg-black/30 p-2.5 rounded border border-white/5 break-all flex gap-2 items-start">
                       <ExternalLink size={12} className="mt-0.5 shrink-0" />
                       <span className="text-blue-400">{getGeneratedLink()}</span>
                   </div>
               </div>
           </div>
        </Section>

        {/* List Content Panel - Only for List Layout */}
        {config.layout === 'list' && (
            <Section title="List Content" icon={<List size={16} />} defaultOpen={true}>
                <div className="space-y-4">
                     <DndContext 
                        id="list-items-dnd"
                        sensors={sensors} 
                        collisionDetection={closestCenter} 
                        onDragEnd={handleListItemDragEnd}
                    >
                        <SortableContext items={(config.content.listItems || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                                {(config.content.listItems || []).map((item, idx) => (
                                    <SortableListItemControl 
                                        key={item.id} 
                                        item={item} 
                                        onChange={(newItem) => handleListItemChange(idx, newItem)}
                                        onRemove={() => handleListItemRemove(idx)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                    
                    <button 
                        onClick={handleListItemAdd}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={14} /> Add Item
                    </button>
                </div>
            </Section>
        )}
        
        {/* Blog Content Panel - Only for Blog Layout */}
        {config.layout === 'blog' && (
             <Section title="Blog Article" icon={<FileText size={16} />} defaultOpen={true}>
                <div className="space-y-4">
                    <button 
                        onClick={() => setShowBlogModal(true)}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 text-white"
                    >
                        <Search size={16} /> Select Article
                    </button>
                    
                    {config.content.originalBlogPost && (
                        <div className="p-3 bg-black/30 border border-white/5 rounded-lg flex gap-3">
                             <div className="w-12 h-12 bg-black rounded overflow-hidden shrink-0">
                                 {config.content.grid.images[0] ? (
                                     <img src={config.content.grid.images[0]} className="w-full h-full object-cover" />
                                 ) : (
                                     <div className="w-full h-full flex items-center justify-center bg-white/5"><FileText size={16} className="text-gray-600" /></div>
                                 )}
                             </div>
                             <div className="flex-1 min-w-0">
                                 <div className="text-xs font-bold text-white truncate">{config.content.heading}</div>
                                 <div className="text-[10px] text-gray-500 truncate">{new Date(config.content.originalBlogPost.published_at).toLocaleDateString()}</div>
                             </div>
                        </div>
                    )}
                </div>
             </Section>
        )}
        
        {/* Typography Section - Enabled for Standard, Product, List, and Blog. NOT for Image Grid */}
        {(config.layout === 'standard' || config.layout === 'product' || config.layout === 'list' || config.layout === 'blog') && (
          <Section title="Typography" icon={<Type size={16} />} defaultOpen={true}>
            <div className="space-y-4">
              <Input label={`${t.title} (${currentLanguage?.toUpperCase()})`} value={config.content.heading} onChange={(v) => update('content.heading', v)} />
              <Input label={`${t.sub} (${currentLanguage?.toUpperCase()})`} value={config.content.subtitle} onChange={(v) => update('content.subtitle', v)} textarea />
              
              <div className="pt-2 border-t border-white/5 space-y-3">
                <Toggle label="Show Big Number" checked={config.content.bigNumber.visible} onChange={(v) => update('content.bigNumber.visible', v)} primary={primaryColor} />
                {config.content.bigNumber.visible && (
                  <Input value={config.content.bigNumber.value} onChange={(v) => update('content.bigNumber.value', v)} placeholder="e.g. 50%" />
                )}
              </div>

              <div className="pt-2 border-t border-white/5 space-y-3">
                <Toggle label="Show CTA Button" checked={config.content.cta.visible} onChange={(v) => update('content.cta.visible', v)} primary={primaryColor} />
                {config.content.cta.visible && (
                  <Input value={config.content.cta.text} onChange={(v) => update('content.cta.text', v)} placeholder={t.cta} />
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Product Info Section - ONLY for Product Layout */}
        {config.layout === 'product' && (
            <Section title="Product Info" icon={<Tag size={16} />} defaultOpen={true}>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input 
                                label={`Prefix (${currentLanguage?.toUpperCase()})`}
                                value={config.content.productOverlay.pricePrefix} 
                                onChange={(v) => update('content.productOverlay.pricePrefix', v)} 
                                placeholder={t.pricePrefix}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1 block mb-1.5">Price</label>
                            <input
                                type="number"
                                step="0.01"
                                value={config.content.productOverlay.price || ''}
                                onChange={(e) => update('content.productOverlay.price', parseFloat(e.target.value))}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors"
                            />
                        </div>
                    </div>
                </div>
            </Section>
        )}
        </div>
      </>
      )}

      {/* Shared Modals - Render in content view where triggered */}
      {view === 'content' && (
        <>
            <ImageSourceModal 
                isOpen={showImageModal}
                onClose={() => setShowImageModal(false)}
                onSelect={handleImageModalSelect}
                primaryColor={primaryColor}
                currentProduct={config.content.productOverlay.originalProduct}
            />
            <BlogPickerModal 
                isOpen={showBlogModal}
                onClose={() => setShowBlogModal(false)}
                onSelect={handleBlogSelect}
                primary={primaryColor}
                language={currentLanguage || 'en'}
            />
        </>
      )}
    </div>
  );
}