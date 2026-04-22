import React, { useState, useCallback, useRef } from 'react';
import { Download, Send, ChevronLeft, ChevronRight, Loader2, Linkedin, MoreHorizontal, Globe, Palette, Sparkles, Settings, Save, FolderOpen } from 'lucide-react';
import { arrayMove } from '@dnd-kit/sortable';
import { jsPDF } from 'jspdf';
import Controls from './components/Controls';
import InspirationPanel from './components/InspirationPanel';
import BannerPreview from './components/BannerPreview';
import SaveModal from './components/SaveModal';
import ProjectManager from './components/ProjectManager';
import { BannerConfig, BlogPostRow, Language, SavedProject } from './types';
import { DEFAULT_CONFIG, FORMATS, SITE_PAGES } from './constants';
import { supabase } from './supabase';

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function App() {
  // State is now an array of slides
  const [slides, setSlides] = useState<BannerConfig[]>([DEFAULT_CONFIG]);
  const [activeSlideIndex, setActiveIndex] = useState(0);
  
  // Global Language State (Single source of truth for the UI)
  const [globalLanguage, setGlobalLanguage] = useState<Language>('en');
  
  // Sidebar State
  const [activeTab, setActiveTab] = useState<'plan' | 'design'>('design');
  
  // LinkedIn Post Text (Global for the carousel/post)
  const [postText, setPostText] = useState('');
  // Store translations for Post Text
  const [postTextMap, setPostTextMap] = useState<Record<string, string>>({ en: '', sl: '', hr: '' });
  
  // Project Management State
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string>('');
  const [currentProjectDate, setCurrentProjectDate] = useState<string | null>(null);
  const [currentProjectFolder, setCurrentProjectFolder] = useState<string | null>(null);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  
  const exportContainerRef = useRef<HTMLDivElement>(null);

  // Helper to get active config
  const activeConfig = slides[activeSlideIndex];
  const format = FORMATS[activeConfig.format];

  // --- Localization Logic ---

  // Helper: Reads content with fallback
  // localized_field (e.g. heading_sl) -> fallback_field (e.g. heading_en) -> current display value
  const getLocalizedValue = (obj: any, field: string, lang: string) => {
      return obj[`${field}_${lang}`] || obj[`${field}_en`] || obj[field] || '';
  };

  const handleLanguageSwitch = (newLang: Language) => {
      // 1. Save current post text to map before switching
      const updatedMap = { ...postTextMap, [globalLanguage]: postText };
      setPostTextMap(updatedMap);
      
      // 2. Load text for new language (fallback to existing text if empty to avoid blank slate)
      setPostText(updatedMap[newLang] || (updatedMap['en'] !== postText ? postText : ''));
      
      setGlobalLanguage(newLang);
      
      // 3. Update ALL slides to display the content for the selected language
      setSlides(prevSlides => prevSlides.map(slide => {
          const content = slide.content;
          
          // Handle List Items Localization
          const newListItems = (content.listItems || []).map(item => ({
              ...item,
              title: getLocalizedValue(item, 'title', newLang),
              description: getLocalizedValue(item, 'description', newLang)
          }));

          return {
              ...slide,
              content: {
                  ...content,
                  // Swap "Display" fields with the value from the new language storage
                  heading: getLocalizedValue(content, 'heading', newLang),
                  subtitle: getLocalizedValue(content, 'subtitle', newLang),
                  cta: {
                      ...content.cta,
                      text: getLocalizedValue(content.cta, 'text', newLang)
                  },
                  productOverlay: {
                      ...content.productOverlay,
                      pricePrefix: getLocalizedValue(content.productOverlay, 'pricePrefix', newLang) || (newLang === 'sl' ? 'Cena od' : newLang === 'hr' ? 'Cijena od' : 'Price from')
                  },
                  link: {
                      ...content.link,
                      // ALSO swap the URL if it's localized
                      url: getLocalizedValue(content.link, 'url', newLang),
                      language: newLang // Update link generation context
                  },
                  listItems: newListItems
              }
          };
      }));
  };

  // Smart update function: handles global vs local updates
  const update = useCallback((path: string, value: any) => {
    setSlides(prevSlides => {
      const newSlides = [...prevSlides];
      
      // If changing format, apply to ALL slides to keep carousel consistent
      if (path === 'format') {
        return newSlides.map(slide => ({ ...slide, format: value }));
      }

      // Otherwise, update only the active slide
      const currentSlide = JSON.parse(JSON.stringify(newSlides[activeSlideIndex]));
      
      const keys = path.split('.');
      let obj = currentSlide;
      
      // Navigate to the parent object
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      
      const lastKey = keys[keys.length - 1];
      
      // 1. Update the Display Value
      obj[lastKey] = value;
      
      // 2. Suffix-based Localization Logic
      const textFields = ['heading', 'subtitle', 'text', 'pricePrefix', 'url'];
      if (textFields.includes(lastKey)) {
          // Save to localized field, e.g., 'heading_sl'
          obj[`${lastKey}_${globalLanguage}`] = value;
      }
      
      // Special Handling for List Items update (if entire array is replaced)
      if (lastKey === 'listItems') {
         // Assuming value is ListItem[], we ensure current display values are saved to localized slots
         obj[lastKey] = (value as any[]).map(item => ({
             ...item,
             [`title_${globalLanguage}`]: item.title,
             [`description_${globalLanguage}`]: item.description
         }));
      }

      newSlides[activeSlideIndex] = currentSlide;
      return newSlides;
    });
  }, [activeSlideIndex, globalLanguage]);

  // Batch Update for Auto Translate (Atomic update of multiple fields)
  const batchUpdate = useCallback((updates: Record<string, any>) => {
      setSlides(prevSlides => {
          const newSlides = [...prevSlides];
          const currentSlide = JSON.parse(JSON.stringify(newSlides[activeSlideIndex]));
          
          Object.entries(updates).forEach(([path, value]) => {
              const keys = path.split('.');
              let obj = currentSlide;
              for (let i = 0; i < keys.length - 1; i++) {
                  obj = obj[keys[i]];
              }
              const lastKey = keys[keys.length - 1];
              obj[lastKey] = value;
          });
          
          newSlides[activeSlideIndex] = currentSlide;
          return newSlides;
      });
  }, [activeSlideIndex]);

  // Bulk update helper for Inspiration Panel
  const applyContent = (data: Partial<BannerConfig['content']> & { layout?: any }) => {
      setSlides(prevSlides => {
          const newSlides = [...prevSlides];
          const currentSlide = newSlides[activeSlideIndex];
          
          if (data.layout) {
              currentSlide.layout = data.layout;
          }

          currentSlide.content = {
              ...currentSlide.content,
              ...data,
              cta: data.cta ? { ...currentSlide.content.cta, ...data.cta } : currentSlide.content.cta,
              listItems: data.listItems ? data.listItems : currentSlide.content.listItems,
              grid: {
                  ...currentSlide.content.grid,
              }
          };
          
          return newSlides;
      });
      setActiveTab('design');
  };

  // NEW: Replaces the entire slide deck with a generated narrative
  const handleApplyNarrative = (newSlides: BannerConfig[], generatedPostText?: string) => {
      // Ensure we preserve the current theme/format if not explicitly overridden by the generator
      setSlides(newSlides);
      if (generatedPostText) {
          setPostText(generatedPostText);
          setPostTextMap(prev => ({ ...prev, [globalLanguage]: generatedPostText }));
      }
      setActiveIndex(0);
      setActiveTab('design');
      // Reset project ID since it's a new generation
      setCurrentProjectId(null);
      setCurrentProjectName('');
      setCurrentProjectFolder(null);
  };

  // Slide Management
  const addSlide = () => {
    const newSlide = JSON.parse(JSON.stringify(activeConfig));
    newSlide.id = generateId();
    newSlide.content.heading = "New Slide";
    newSlide.content.heading_en = "New Slide"; 
    newSlide.content.subtitle = "Add your content here";
    newSlide.content.subtitle_en = "Add your content here"; 
    
    setSlides([...slides, newSlide]);
    setActiveIndex(slides.length); 
  };

  const duplicateSlide = (index: number) => {
    const slideToCopy = JSON.parse(JSON.stringify(slides[index]));
    slideToCopy.id = generateId();
    const newSlides = [...slides];
    newSlides.splice(index + 1, 0, slideToCopy);
    setSlides(newSlides);
    setActiveIndex(index + 1);
  };

  const removeSlide = (index: number) => {
    if (slides.length <= 1) return;
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
    if (activeSlideIndex >= index && activeSlideIndex > 0) {
      setActiveIndex(activeSlideIndex - 1);
    }
  };

  const handleReorderSlides = (oldIndex: number, newIndex: number) => {
    setSlides((items) => arrayMove(items, oldIndex, newIndex));
    let newActiveIndex = activeSlideIndex;
    if (activeSlideIndex === oldIndex) {
      newActiveIndex = newIndex;
    } else if (oldIndex < activeSlideIndex && newIndex >= activeSlideIndex) {
      newActiveIndex = activeSlideIndex - 1;
    } else if (oldIndex > activeSlideIndex && newIndex <= activeSlideIndex) {
      newActiveIndex = activeSlideIndex + 1;
    }
    setActiveIndex(newActiveIndex);
  };

  // --- Generation & Saving Logic ---
  
  // Helper: Prepare a copy of slides specific to a language (swaps display values)
  const getSlidesForLanguage = (lang: string) => {
     return slides.map(slide => {
        const content = slide.content;
        return {
            ...slide,
            content: {
                ...content,
                heading: getLocalizedValue(content, 'heading', lang),
                subtitle: getLocalizedValue(content, 'subtitle', lang),
                cta: { ...content.cta, text: getLocalizedValue(content.cta, 'text', lang) },
                productOverlay: { 
                    ...content.productOverlay, 
                    pricePrefix: getLocalizedValue(content.productOverlay, 'pricePrefix', lang) || (lang === 'sl' ? 'Cena od' : lang === 'hr' ? 'Cijena od' : 'Price from')
                },
                listItems: (content.listItems || []).map(item => ({
                   ...item,
                   title: getLocalizedValue(item, 'title', lang),
                   description: getLocalizedValue(item, 'description', lang)
                }))
            }
        };
     });
  };

  // Helper to calculate the target URL for a specific language
  const calculateUrlForLanguage = (lang: string) => {
      // Find the slide that has a CTA (usually last or second to last), or fallback to active slide
      const ctaSlide = slides.find(s => s.content.cta.visible && s.content.cta.text) || activeConfig;
      const { type, url } = ctaSlide.content.link || { type: 'homepage', url: '' };
      
      const baseUrl = "https://toastagift.com";
      const prefix = lang === 'en' ? '' : `/${lang}`;
      
      if (type === 'homepage') {
          return `${baseUrl}${lang === 'en' ? '/' : prefix}`;
      }
      
      if (type === 'product') {
          let path = 'product';
          if (lang === 'sl') path = 'izdelek';
          if (lang === 'hr') path = 'proizvod';
          // Use specific localized URL if available, else shared URL/ItemCode
          const finalCode = ctaSlide.content.link[`url_${lang}`] || url || '{ItemCode}';
          return `${baseUrl}${prefix}/${path}/${finalCode}`;
      }
      
      if (type === 'category') {
          const catPath = lang === 'en' ? '/' : prefix;
          const parts = (url || '').split('&subcategory=');
          const main = parts[0];
          const sub = parts[1];
          // Simple encoding replacement
          const encode = (s: string) => encodeURIComponent(s).replace(/%20/g, '+');
          let link = `${baseUrl}${catPath}?category=${encode(main)}`;
          if (sub) {
              link += `&subcategory=${encode(sub)}`;
          }
          return link;
      }
      
      if (type === 'page') {
          const pageObj = SITE_PAGES.find(p => p.id === url);
          if (pageObj) {
              const localizedPath = pageObj[lang as keyof typeof pageObj];
              return `${baseUrl}${localizedPath}`;
          }
          return `${baseUrl}${prefix}/${url.startsWith('/') ? url : '/'+url}`;
      }
      
      if (type === 'blog') {
          let blogPath = '/blog/';
          if (lang === 'sl') blogPath = '/sl/blog/';
          if (lang === 'hr') blogPath = '/hr/blog/';
          const slug = ctaSlide.content.link[`url_${lang}`] || url;
          return `${baseUrl}${blogPath}${slug}`;
      }
      
      if (url.startsWith('http')) return url;
      return `${baseUrl}${prefix}/${url}`;
  };

  const generateAssetsAndUpload = async (projectId: string) => {
      if (!exportContainerRef.current) return null;
      
      const html2canvasModule = await import(/* @vite-ignore */ 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.min.js');
      const html2canvas = html2canvasModule.default;
      
      const generatedAssets: Record<string, { type: 'pdf' | 'image', url: string }> = {};
      const languages = ['en', 'sl', 'hr'];
      
      // For each language, we grab the specific pre-rendered container
      for (const lang of languages) {
          const container = exportContainerRef.current.querySelector(`#export-${lang}`);
          if (!container) continue;
          
          const slideElements = Array.from(container.children) as HTMLElement[];
          const isCarousel = slideElements.length > 1;
          
          let fileData: Blob | null = null;
          let fileExt = 'png';
          let contentType = 'image/png';
          
          if (isCarousel) {
              // Generate PDF
              const pdf = new jsPDF({
                  orientation: 'portrait',
                  unit: 'px',
                  format: [format.width, format.height]
              });
              
              for (let i = 0; i < slideElements.length; i++) {
                  const canvas = await html2canvas(slideElements[i], {
                      scale: 1, useCORS: true, allowTaint: true, backgroundColor: '#000000'
                  });
                  const imgData = canvas.toDataURL('image/jpeg', 0.9);
                  
                  if (i > 0) pdf.addPage([format.width, format.height]);
                  pdf.addImage(imgData, 'JPEG', 0, 0, format.width, format.height);
              }
              fileData = pdf.output('blob');
              fileExt = 'pdf';
              contentType = 'application/pdf';
          } else {
              // Generate Single Image
              const canvas = await html2canvas(slideElements[0], {
                  scale: 1, useCORS: true, allowTaint: true, backgroundColor: '#000000'
              });
              const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
              fileData = blob;
          }
          
          if (fileData) {
              const fileName = `${projectId}/${lang}/${Date.now()}.${fileExt}`;
              const { data, error } = await supabase.storage
                  .from('scheduled-assets')
                  .upload(fileName, fileData, { contentType, upsert: true });
                  
              if (!error && data) {
                  const { data: publicUrlData } = supabase.storage.from('scheduled-assets').getPublicUrl(fileName);
                  generatedAssets[lang] = {
                      type: isCarousel ? 'pdf' : 'image',
                      url: publicUrlData.publicUrl
                  };
              } else {
                  console.error(`Upload failed for ${lang}`, error);
                  // Throw error to be caught by handleSaveProject and displayed in Modal
                  throw new Error(`Storage Error (${lang}): ${error.message}`);
              }
          }
      }
      return generatedAssets;
  };

  const handleSaveProject = async (name: string, scheduledAt: string | null, folder: string | null) => {
      // 1. Determine ID (New or Existing)
      const projectId = currentProjectId || generateId(); // Temporary ID if new, replaced by DB ID later
      
      // 2. Prepare Links
      const links = {
          en: calculateUrlForLanguage('en'),
          sl: calculateUrlForLanguage('sl'),
          hr: calculateUrlForLanguage('hr')
      };

      // 3. Prepare Base Payload
      let payload: any = {
          name,
          slides: slides,
          updated_at: new Date().toISOString(),
          folder: folder,
          post_texts: { ...postTextMap, [globalLanguage]: postText }, // Ensure current text is saved
          links: links, // Save generated links to DB for N8N
          scheduled_at: scheduledAt,
          status: scheduledAt ? 'scheduled' : 'draft'
      };

      try {
          // If scheduling, generate assets!
          if (scheduledAt) {
              const assets = await generateAssetsAndUpload(projectId);
              if (assets) {
                  payload.generated_assets = assets;
              }
          }
          
          // Database Upsert
          if (currentProjectId) {
              const { error } = await supabase.from('projects').update(payload).eq('id', currentProjectId);
              if (error) throw error;
          } else {
              const { data, error } = await supabase.from('projects').insert(payload).select().single();
              if (error) throw error;
              if (data) setCurrentProjectId(data.id);
          }
          
          setCurrentProjectName(name);
          setCurrentProjectDate(scheduledAt);
          setCurrentProjectFolder(folder);
          
          alert("Project saved successfully!");
          setIsSaveModalOpen(false);

      } catch (err: any) {
          console.error("Save failed", err);
          throw err; 
      }
  };

  // Data migration helper: fill missing _en fields with valid data
  const sanitizeSlides = (slides: BannerConfig[]) => {
      return slides.map(slide => {
          const s = JSON.parse(JSON.stringify(slide));
          // Backfill Heading
          if (s.content.heading && !s.content.heading_en) s.content.heading_en = s.content.heading;
          // Backfill Subtitle
          if (s.content.subtitle && !s.content.subtitle_en) s.content.subtitle_en = s.content.subtitle;
          // Backfill CTA
          if (s.content.cta.text && !s.content.cta.text_en) s.content.cta.text_en = s.content.cta.text;
          // Backfill URL
          if (s.content.link.url && !s.content.link.url_en) s.content.link.url_en = s.content.link.url;
          return s;
      });
  };

  const handleLoadProject = (project: SavedProject) => {
      // Ensure slides are parsed if they come in as string (should be object via Supabase JS)
      let loadedSlides = project.slides;
      
      if (!loadedSlides) {
          console.warn("Project has no slides data. Loading default.");
          loadedSlides = [DEFAULT_CONFIG];
      } else if (typeof loadedSlides === 'string') {
          try {
              loadedSlides = JSON.parse(loadedSlides);
          } catch (e) {
              console.error("Failed to parse slides JSON", e);
              loadedSlides = [DEFAULT_CONFIG];
          }
      }

      // Sanitize loaded slides to fix missing legacy data
      const safeSlides = sanitizeSlides(loadedSlides);

      setSlides(safeSlides);
      setCurrentProjectId(project.id);
      setCurrentProjectName(project.name);
      setCurrentProjectDate(project.scheduled_at || null);
      setCurrentProjectFolder(project.folder || null);
      
      // Load Post Texts
      if ((project as any).post_texts) {
          setPostTextMap((project as any).post_texts);
          setPostText((project as any).post_texts[globalLanguage] || '');
      } else {
          setPostText('');
          setPostTextMap({ en: '', sl: '', hr: '' });
      }

      setActiveIndex(0);
      setActiveTab('design');
  };

  // Reset state for a fresh project
  const handleNewProject = () => {
      setSlides([DEFAULT_CONFIG]);
      setCurrentProjectId(null);
      setCurrentProjectName('');
      setCurrentProjectDate(null);
      setCurrentProjectFolder(null);
      setPostText('');
      setPostTextMap({ en: '', sl: '', hr: '' });
      setActiveIndex(0);
      setActiveTab('design');
      setIsProjectManagerOpen(false);
  };

  const handleExport = async () => {
    if (!exportContainerRef.current || isExporting) return;
    setIsExporting(true);
    
    try {
      const html2canvasModule = await import(/* @vite-ignore */ 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.min.js');
      const html2canvas = html2canvasModule.default;
      
      // Export only current language (first group in hidden container)
      const container = exportContainerRef.current.querySelector(`#export-${globalLanguage}`);
      if (!container) throw new Error("Export container not found");

      const slideElements = Array.from(container.children) as HTMLElement[];
      const isMultipleSlides = slideElements.length > 1;

      if (isMultipleSlides) {
          // --- PDF EXPORT (Carousel) ---
          const pdf = new jsPDF({
              orientation: 'portrait',
              unit: 'px',
              format: [format.width, format.height]
          });

          for (let i = 0; i < slideElements.length; i++) {
              const canvas = await html2canvas(slideElements[i], {
                  scale: 1,
                  useCORS: true,
                  allowTaint: true,
                  backgroundColor: '#000000',
                  width: format.width,
                  height: format.height,
                  logging: false
              });
              
              const imgData = canvas.toDataURL('image/jpeg', 1.0);
              
              if (i > 0) pdf.addPage([format.width, format.height]);
              pdf.addImage(imgData, 'JPEG', 0, 0, format.width, format.height);
          }
          
          pdf.save(`socialframe-${globalLanguage}-${Date.now()}.pdf`);

      } else {
          // --- SINGLE IMAGE EXPORT ---
          const element = slideElements[0];
          const canvas = await html2canvas(element, {
              scale: 1,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#000000',
              width: format.width,
              height: format.height,
              logging: false
          });
          
          const link = document.createElement('a');
          link.download = `socialframe-${format.label}-${globalLanguage}.png`;
          link.href = canvas.toDataURL('image/png', 1.0);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }

    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Check console.');
    } finally {
      setIsExporting(false);
    }
  };

  const scale = activeConfig.format === 'story' ? 0.35 : 0.45;

  return (
    <div className="flex h-screen bg-background text-white font-sans overflow-hidden">
      
      {/* Navigation Rail */}
      <nav className="w-16 bg-[#09090b] border-r border-white/5 flex flex-col items-center py-6 gap-6 z-30 shrink-0">
         <div 
             className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg mb-4"
             style={{ background: `linear-gradient(135deg, ${activeConfig.theme.primaryColor} 0%, ${activeConfig.theme.primaryColor}cc 100%)` }}
         >
             S
         </div>

         <button 
            onClick={() => setActiveTab('plan')}
            title="Inspiration & Planning"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${activeTab === 'plan' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
         >
             <Sparkles size={20} />
         </button>

         <button 
            onClick={() => setActiveTab('design')}
            title="Design & Layout"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${activeTab === 'design' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
         >
             <Palette size={20} />
         </button>
         
         <div className="w-8 h-px bg-white/10 my-2"></div>

         <button 
            onClick={() => setIsProjectManagerOpen(true)}
            title="My Projects"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all"
         >
             <FolderOpen size={20} />
         </button>
         
         <div className="flex-1" />
         
         <button className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all">
             <Settings size={20} />
         </button>
      </nav>

      {/* Left Sidebar: Dynamic Content (Planning OR Design) */}
      <div className="border-r border-white/5 bg-surface relative z-20 transition-all duration-300">
         {activeTab === 'design' ? (
             <Controls 
                view="design"
                config={activeConfig} 
                update={update}
                batchUpdate={batchUpdate}
                slides={slides}
                activeSlideIndex={activeSlideIndex}
                onSlideChange={setActiveIndex}
                onAddSlide={addSlide}
                onRemoveSlide={removeSlide}
                onDuplicateSlide={duplicateSlide}
                onReorderSlides={handleReorderSlides}
                postText={postText}
                setPostText={setPostText}
                setPostTextTranslations={setPostTextMap} // Pass the map setter
                // Language Props
                currentLanguage={globalLanguage}
                onLanguageChange={handleLanguageSwitch}
              />
         ) : (
             <InspirationPanel 
                onApply={applyContent}
                onApplyNarrative={handleApplyNarrative}
                primaryColor={activeConfig.theme.primaryColor}
                language={globalLanguage}
             />
         )}
      </div>

      {/* Main Area: Preview & Actions */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0c0c0e]">
        
        {/* Top Action Bar */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-surface/30 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
             <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-gray-400">
               {format.width} × {format.height}px
             </div>
             <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-gray-400 uppercase">
               {globalLanguage}
             </div>
             {currentProjectName && (
                 <div className="flex items-center gap-2 ml-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-xs font-medium text-purple-300">
                     <FolderOpen size={12} /> {currentProjectName}
                 </div>
             )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-all text-white disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              {isExporting ? `Exporting...` : (slides.length > 1 ? 'Download PDF' : 'Download Image')}
            </button>
            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-95"
              style={{ background: `linear-gradient(135deg, ${activeConfig.theme.primaryColor} 0%, ${activeConfig.theme.primaryColor}dd 100%)` }}
            >
              <Save size={16} />
              Save & Schedule
            </button>
          </div>
        </div>

        {/* Preview Canvas Area */}
        <div className="flex-1 overflow-auto flex flex-col items-center p-10 relative">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" 
            style={{ 
               backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', 
               backgroundSize: '24px 24px' 
            }} 
          />
          
          {/* LinkedIn Feed Simulation Container */}
          <div className="relative z-10 max-w-2xl w-full flex flex-col gap-4">
              
              {/* Feed Header & Text */}
              <div className="bg-[#1b1f23] rounded-t-lg border border-white/5 p-4 w-full shadow-2xl">
                  <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                              <Linkedin size={20} className="text-white" />
                          </div>
                          <div>
                              <div className="text-sm font-bold text-white">Your Brand Name</div>
                              <div className="text-xs text-gray-400 flex items-center gap-1">
                                  <span>23,401 followers</span> • <span>Now</span> • <Globe size={10} />
                              </div>
                          </div>
                      </div>
                      <MoreHorizontal className="text-gray-400" size={20} />
                  </div>
                  
                  {/* LinkedIn Text Body Placeholder */}
                  <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed min-h-[20px]">
                      {postText || <span className="text-gray-500 italic">Start typing in the sidebar to preview your post content here...</span>}
                  </div>
              </div>

              {/* The visible scaled preview container (The Image) */}
              <div 
                 className="relative transition-all duration-500 ease-out shadow-2xl ring-1 ring-white/10 overflow-hidden mx-auto bg-black"
                 style={{ 
                    width: format.width * scale, 
                    height: format.height * scale,
                    borderRadius: '0 0 8px 8px'
                 }}
              >
                 {/* Navigation Arrows (Inside Container for UX) */}
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-20">
                     <button 
                        onClick={() => setActiveIndex(Math.max(0, activeSlideIndex - 1))}
                        disabled={activeSlideIndex === 0}
                        className="pointer-events-auto p-2 rounded-full bg-black/50 hover:bg-white/10 text-white backdrop-blur-md transition-all disabled:opacity-0 disabled:pointer-events-none border border-white/10"
                     >
                        <ChevronLeft size={20} />
                     </button>
                     <button 
                        onClick={() => setActiveIndex(Math.min(slides.length - 1, activeSlideIndex + 1))}
                        disabled={activeSlideIndex === slides.length - 1}
                        className="pointer-events-auto p-2 rounded-full bg-black/50 hover:bg-white/10 text-white backdrop-blur-md transition-all disabled:opacity-0 disabled:pointer-events-none border border-white/10"
                     >
                        <ChevronRight size={20} />
                     </button>
                  </div>

                 {/* The actual content scaled down via transform */}
                 <div 
                    className="origin-top-left"
                    style={{ 
                       transform: `scale(${scale})`, 
                       width: format.width, 
                       height: format.height 
                    }}
                 >
                    {/* Render only the active slide for performance */}
                    <BannerPreview config={activeConfig} />
                 </div>
              </div>
          </div>

        </div>
      </main>

      {/* Right Sidebar: Content Controls */}
      <Controls 
        view="content"
        className="border-l border-white/5"
        config={activeConfig} 
        update={update}
        batchUpdate={batchUpdate}
        slides={slides}
        activeSlideIndex={activeSlideIndex}
        onSlideChange={setActiveIndex}
        onAddSlide={addSlide}
        onRemoveSlide={removeSlide}
        onDuplicateSlide={duplicateSlide}
        onReorderSlides={handleReorderSlides}
        postText={postText}
        setPostText={setPostText}
        setPostTextTranslations={setPostTextMap}
        // Pass language props down
        currentLanguage={globalLanguage}
        onLanguageChange={handleLanguageSwitch}
      />

      {/* Hidden container for full-resolution HTML2Canvas export of ALL languages */}
      <div 
         ref={exportContainerRef}
         style={{ 
             position: 'fixed', 
             left: 0, 
             top: 0, 
             zIndex: -9999, 
             opacity: 0,
             pointerEvents: 'none',
             display: 'flex', 
             flexDirection: 'column' 
         }}
      >
         {/* Render groups for each language to capture simultaneously */}
         {['en', 'sl', 'hr'].map(lang => {
             const langSlides = getSlidesForLanguage(lang);
             return (
                 <div key={lang} id={`export-${lang}`}>
                    {langSlides.map((slide, idx) => {
                        const slideFmt = FORMATS[slide.format];
                        return (
                            <div key={idx} style={{ 
                                width: slideFmt.width, 
                                height: slideFmt.height, 
                                flexShrink: 0,
                                overflow: 'hidden'
                            }}>
                                <BannerPreview config={slide} isExport={true} />
                            </div>
                        );
                    })}
                 </div>
             );
         })}
      </div>

      <SaveModal 
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveProject}
        initialName={currentProjectName}
        initialDate={currentProjectDate}
        initialFolder={currentProjectFolder}
        primary={activeConfig.theme.primaryColor}
      />

      <ProjectManager 
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        onLoad={handleLoadProject}
        onNewProject={handleNewProject}
        currentProjectId={currentProjectId}
      />

    </div>
  );
}