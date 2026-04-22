import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload, Link as LinkIcon, Palette, Image as ImageIcon, Package, Search, Sparkles, Check, Loader2, ArrowLeft, Filter, Plus } from 'lucide-react';
import { supabase } from '../supabase';
import { GoogleGenAI } from "@google/genai";
import { Product } from '../types';
import { PRODUCT_CATEGORIES } from '../constants';

interface ImageSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string | string[], product?: Product) => void;
  primaryColor: string;
  currentProduct?: Product; // For "Recent" functionality
}

// Get API Key
const GOOGLE_API_KEY = process.env.API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY || '';

export default function ImageSourceModal({ isOpen, onClose, onSelect, primaryColor, currentProduct }: ImageSourceModalProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'upload' | 'url' | 'color'>('products');
  
  // --- Product Search State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isSemantic, setIsSemantic] = useState(false);
  
  // Hierarchical Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [categoryTree, setCategoryTree] = useState<Record<string, string[]>>({});
  const [mainCategories, setMainCategories] = useState<string[]>([]);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Selected Product within Modal (for drilling down into images)
  const [activeProductView, setActiveProductView] = useState<Product | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // --- General State ---
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  // Initialize GenAI
  if (!aiRef.current && GOOGLE_API_KEY) {
    aiRef.current = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  }

  // --- Effects ---
  useEffect(() => {
    if (isOpen) {
      // Reset state on open
      setActiveTab('products');
      if (products.length === 0) performSearch('', '', ''); // Initial load
      fetchCategories();
      setSelectedImages([]);
    }
  }, [isOpen]);

  useEffect(() => {
      // Clear selections when switching products
      setSelectedImages([]);
  }, [activeProductView]);

  // Derived state for available subcategories
  const availableSubCategories = useMemo(() => {
      if (!selectedCategory) return [];
      return (categoryTree[selectedCategory] || []).sort();
  }, [selectedCategory, categoryTree]);

  const allMainCategories = useMemo(() => {
      // Merge DB categories with Constants to ensure complete list
      const combined = new Set([...mainCategories, ...PRODUCT_CATEGORIES]);
      return Array.from(combined).filter(c => c && c.trim() !== '' && c !== 'Category').sort();
  }, [mainCategories]);

  // Fetch Categories - Tree Builder with High Limit
  const fetchCategories = async () => {
     if (Object.keys(categoryTree).length > 0) return;
     try {
         const { data } = await supabase
            .from('XD')
            .select('MainCategory, SubCategory')
            .neq('IsDiscontinued', true)
            .neq('MainCategory', '')
            .neq('MainCategory', 'Category')
            .not('MainCategory', 'is', null)
            .limit(20000); // 20k limit covers full catalog to find all distinct categories
            
         if (data) {
             const tree: Record<string, string[]> = {};
             
             data.forEach((item: any) => {
                 const main = item.MainCategory?.trim();
                 const sub = item.SubCategory?.trim();

                 if (main && main !== 'Category') {
                     if (!tree[main]) {
                         tree[main] = [];
                     }
                     if (sub && !tree[main].includes(sub)) {
                         tree[main].push(sub);
                     }
                 }
             });

             setCategoryTree(tree);
             setMainCategories(Object.keys(tree).sort());
         }
     } catch (e) { console.error(e); }
  };

  // --- Search Logic ---
  const performSearch = async (term: string, category?: string, subCategory?: string) => {
    setLoading(true);
    setError(null);
    
    const activeCat = category !== undefined ? category : selectedCategory;
    const activeSub = subCategory !== undefined ? subCategory : selectedSubCategory;

    try {
      let data: Product[] = [];

      if (isSemantic && term.trim().length > 0) {
        if (!aiRef.current) throw new Error("Google API Key missing for AI search.");
        const embedResult = await aiRef.current.models.embedContent({
            model: 'text-embedding-004',
            contents: { parts: [{ text: term }] } 
        });
        const embedding = embedResult.embeddings?.[0]?.values || embedResult.embedding?.values;
        if (!embedding) throw new Error("Failed to generate embedding.");
        
        const { data: rpcData, error: rpcError } = await supabase.rpc('match_products', {
          query_embedding: embedding,
          match_threshold: 0.5,
          match_count: 50,
          category_filter: activeCat || null
        });
        if (rpcError) throw rpcError;
        
        data = rpcData || [];
        
        // Client-side subcategory refinement for vector results
        if (activeSub && data.length > 0) {
            data = data.filter(p => p.SubCategory === activeSub);
        }

      } else {
        let query = supabase
          .from('XD')
          .select('*')
          .neq('IsDiscontinued', true)
          .limit(1000); // Increased limit

        if (term.trim()) {
           query = query.or(`ItemName.ilike.%${term}%,ItemCode.ilike.%${term}%`);
        }
        if (activeCat) {
          query = query.eq('MainCategory', activeCat);
        }
        if (activeSub) {
          query = query.eq('SubCategory', activeSub);
        }

        const { data: textData, error: textError } = await query;
        if (textError) throw textError;
        data = textData || [];
      }
      setProducts(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---
  const handleMainCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newVal = e.target.value;
      setSelectedCategory(newVal);
      setSelectedSubCategory(''); // Reset sub on parent change
      performSearch(searchTerm, newVal, '');
  };

  const handleSubCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newVal = e.target.value;
      setSelectedSubCategory(newVal);
      performSearch(searchTerm, selectedCategory, newVal);
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onSelect(urlInput.trim());
      setUrlInput('');
      onClose();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onSelect(reader.result as string);
        onClose();
      };
      reader.readAsDataURL(file);
    }
  };

  const parseImages = (product: Product): string[] => {
     const images: string[] = [];
     if (product.MainImage) images.push(product.MainImage);
     if (product.AllImages) {
        const extras = product.AllImages.split(',').map(s => s.trim()).filter(s => s && s !== product.MainImage);
        images.push(...extras);
     }
     return images;
  };

  const toggleImageSelection = (img: string) => {
      setSelectedImages(prev => 
          prev.includes(img) ? prev.filter(i => i !== img) : [...prev, img]
      );
  };

  const handleConfirmSelection = () => {
      if (selectedImages.length > 0) {
          onSelect(selectedImages, activeProductView!);
          onClose();
      }
  };

  const SOLID_COLORS = [
      { id: 'brand', value: 'color:primary', label: 'Brand Color', color: primaryColor },
      { id: 'white', value: 'color:#ffffff', label: 'White', color: '#ffffff' },
      { id: 'black', value: 'color:#000000', label: 'Black', color: '#000000' },
      { id: 'gray', value: 'color:#333333', label: 'Dark Gray', color: '#333333' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl h-[85vh] bg-[#18181b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#18181b]">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ImageIcon size={16} className="text-primary" /> Add Image
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#18181b] shrink-0">
            <button 
                onClick={() => { setActiveTab('products'); setActiveProductView(null); }}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-wide transition-all border-b-2 ${activeTab === 'products' ? 'text-white border-primary bg-white/5' : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <Package size={16} /> Products
                </div>
            </button>
            <button 
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-wide transition-all border-b-2 ${activeTab === 'upload' ? 'text-white border-primary bg-white/5' : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <Upload size={16} /> Upload
                </div>
            </button>
            <button 
                onClick={() => setActiveTab('url')}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-wide transition-all border-b-2 ${activeTab === 'url' ? 'text-white border-primary bg-white/5' : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <LinkIcon size={16} /> URL
                </div>
            </button>
            <button 
                onClick={() => setActiveTab('color')}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-wide transition-all border-b-2 ${activeTab === 'color' ? 'text-white border-primary bg-white/5' : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <Palette size={16} /> Color
                </div>
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col relative bg-[#131315]">
            
            {/* --- TAB: PRODUCTS --- */}
            {activeTab === 'products' && (
                <div className="flex-1 flex flex-col h-full">
                    
                    {/* Search Bar (Only visible if not viewing a specific product) */}
                    {!activeProductView && (
                    <div className="p-4 border-b border-white/5 bg-[#18181b] flex flex-col gap-3">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input 
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && performSearch(searchTerm)}
                                    placeholder={isSemantic ? "Describe context..." : "Search by name or SKU..."}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>
                            
                            {/* Main Category */}
                            <select 
                                value={selectedCategory}
                                onChange={handleMainCategoryChange}
                                className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 w-[140px]"
                            >
                                <option value="" className="bg-[#18181b] text-white">All Categories</option>
                                {allMainCategories.map(cat => (
                                    <option key={cat} value={cat} className="bg-[#18181b] text-white">{cat}</option>
                                ))}
                            </select>

                            {/* Sub Category */}
                            <select 
                                value={selectedSubCategory}
                                onChange={handleSubCategoryChange}
                                disabled={!selectedCategory || availableSubCategories.length === 0}
                                className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="" className="bg-[#18181b] text-white">{availableSubCategories.length === 0 ? 'No Subcats' : 'All Subcats'}</option>
                                {availableSubCategories.map(sub => (
                                    <option key={sub} value={sub} className="bg-[#18181b] text-white">{sub}</option>
                                ))}
                            </select>

                            <button 
                                onClick={() => performSearch(searchTerm)}
                                className="bg-primary px-4 rounded-lg text-white hover:brightness-110"
                            >
                                <Search size={18} />
                            </button>
                        </div>
                        
                        {/* Current/Recent Product Quick Access */}
                        {currentProduct && !activeProductView && (
                             <div className="animate-in slide-in-from-top-2">
                                 <button 
                                    onClick={() => setActiveProductView(currentProduct)}
                                    className="w-full text-left p-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors flex items-center justify-between group"
                                 >
                                     <div className="flex items-center gap-3">
                                         <div className="w-10 h-10 bg-white rounded-lg p-1">
                                             <img src={currentProduct.MainImage || ''} className="w-full h-full object-contain" />
                                         </div>
                                         <div>
                                             <div className="text-xs font-bold text-primary uppercase tracking-wide mb-0.5">Current Product</div>
                                             <div className="text-sm font-semibold text-white">{currentProduct.ItemName}</div>
                                         </div>
                                     </div>
                                     <div className="text-xs font-bold text-white bg-primary px-3 py-1.5 rounded-full group-hover:scale-105 transition-transform">
                                         View Images
                                     </div>
                                 </button>
                             </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                             <button 
                                onClick={() => setIsSemantic(!isSemantic)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wide transition-all ${isSemantic ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-white/5 border-white/10 text-gray-500'}`}
                             >
                                <Sparkles size={12} /> AI Semantic Search
                             </button>
                        </div>
                    </div>
                    )}

                    {/* Product List OR Detail View */}
                    <div className="flex-1 overflow-y-auto p-4">
                        
                        {/* Detail View */}
                        {activeProductView ? (
                            <div className="animate-in slide-in-from-right-4 relative h-full flex flex-col">
                                <button 
                                    onClick={() => setActiveProductView(null)}
                                    className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 text-sm font-bold"
                                >
                                    <ArrowLeft size={16} /> Back to Search
                                </button>
                                
                                <div className="flex items-start gap-4 mb-6 p-4 bg-white/5 rounded-xl border border-white/5 shrink-0">
                                    <div className="w-16 h-16 bg-white rounded-lg p-2 shrink-0">
                                        <img src={activeProductView.MainImage || ''} className="w-full h-full object-contain" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-white">{activeProductView.ItemName}</h3>
                                        <p className="text-sm text-gray-400">{activeProductView.ItemCode} • {activeProductView.MainCategory}</p>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto pb-20">
                                    <div className="grid grid-cols-3 gap-3">
                                        {parseImages(activeProductView).map((img, idx) => {
                                            const isSelected = selectedImages.includes(img);
                                            return (
                                                <button 
                                                    key={idx}
                                                    onClick={() => toggleImageSelection(img)}
                                                    className={`group relative aspect-square rounded-xl bg-white p-2 border transition-all overflow-hidden ${isSelected ? 'border-primary ring-2 ring-primary' : 'border-transparent hover:border-primary/50'}`}
                                                >
                                                    <img src={img} className="w-full h-full object-contain transition-transform group-hover:scale-105" />
                                                    {isSelected && (
                                                        <div className="absolute top-2 right-2 bg-primary text-white p-1 rounded-full shadow-lg z-10">
                                                            <Check size={12} />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Bottom Floating Action Bar */}
                                {selectedImages.length > 0 && (
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#18181b]/90 backdrop-blur border-t border-white/10 flex items-center justify-between animate-in slide-in-from-bottom-2">
                                        <span className="text-sm font-bold text-white">{selectedImages.length} images selected</span>
                                        <button 
                                            onClick={handleConfirmSelection}
                                            className="px-6 py-2 bg-primary hover:bg-primary/90 rounded-lg text-white text-sm font-bold flex items-center gap-2 transition-colors"
                                        >
                                            <Plus size={16} /> Add Selected
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                        /* Grid List */
                            loading ? (
                                <div className="h-40 flex items-center justify-center flex-col gap-3 text-gray-500">
                                    <Loader2 className="animate-spin text-primary" size={24} />
                                    <p className="text-xs font-medium">Searching catalog...</p>
                                </div>
                            ) : products.length === 0 ? (
                                <div className="h-40 flex items-center justify-center flex-col gap-3 text-gray-600">
                                    <Package size={32} className="opacity-20" />
                                    <p className="text-xs">No products found.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {products.map(product => (
                                        <button
                                            key={product.ItemCode}
                                            onClick={() => setActiveProductView(product)}
                                            className="group relative rounded-xl bg-black/20 border border-white/5 hover:border-white/20 overflow-hidden text-left transition-all hover:-translate-y-1"
                                        >
                                            <div className="aspect-square bg-white p-4 relative">
                                                <img 
                                                    src={product.MainImage || ''} 
                                                    className="w-full h-full object-contain mix-blend-multiply opacity-90 group-hover:opacity-100 transition-opacity" 
                                                    loading="lazy"
                                                />
                                            </div>
                                            <div className="p-3">
                                                <h4 className="text-xs font-bold text-gray-200 line-clamp-1 mb-1">{product.ItemName}</h4>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] text-gray-500">{product.ItemCode}</span>
                                                    {product.ItemPriceGross_Qty6 && (
                                                        <span className="text-[10px] font-bold text-emerald-400">€{product.ItemPriceGross_Qty6.toFixed(2)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            {/* --- TAB: UPLOAD --- */}
            {activeTab === 'upload' && (
                <div className="flex-1 p-8 flex items-center justify-center">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-full max-h-[300px] border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all text-center gap-4"
                    >
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white">
                            <Upload size={24} />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-white">Click to Upload</p>
                            <p className="text-sm text-gray-500 mt-1">Supports JPG, PNG, WEBP</p>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleFileUpload}
                        />
                    </div>
                </div>
            )}

            {/* --- TAB: URL --- */}
            {activeTab === 'url' && (
                <div className="flex-1 p-8 flex flex-col justify-center max-w-md mx-auto w-full gap-4">
                    <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input 
                            type="text" 
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-4 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>
                    <button 
                        onClick={handleUrlSubmit}
                        disabled={!urlInput.trim()}
                        className="w-full py-4 bg-primary rounded-xl text-white text-sm font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        Add from URL
                    </button>
                </div>
            )}

            {/* --- TAB: COLOR --- */}
            {activeTab === 'color' && (
                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        {SOLID_COLORS.map((color) => (
                            <button
                                key={color.id}
                                onClick={() => { onSelect(color.value); onClose(); }}
                                className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group text-left"
                            >
                                <div className="w-12 h-12 rounded-full border border-white/10 shadow-sm" style={{ backgroundColor: color.color }}></div>
                                <div>
                                    <div className="text-sm font-bold text-white">{color.label}</div>
                                    <div className="text-xs text-gray-500">Solid Fill</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

        </div>

      </div>
    </div>
  );
}