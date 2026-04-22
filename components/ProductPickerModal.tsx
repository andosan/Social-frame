import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, Search, Package, ChevronRight, ArrowLeft, Loader2, Sparkles, Filter, Grid, Image as ImageIcon, Check, Plus } from 'lucide-react';
import { supabase } from '../supabase';
import { GoogleGenAI } from "@google/genai";
import { Product } from '../types';
import { PRODUCT_CATEGORIES } from '../constants';

interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (urls: string[], product: Product) => void;
  primary: string;
}

// Get API Key from environment variable as per system instructions
const GOOGLE_API_KEY = process.env.API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY || '';

export default function ProductPickerModal({ isOpen, onClose, onSelect, primary }: ProductPickerModalProps) {
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [isSemantic, setIsSemantic] = useState(false);
  
  // Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  
  // Category Structure
  const [categoryTree, setCategoryTree] = useState<Record<string, string[]>>({});
  const [mainCategories, setMainCategories] = useState<string[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize GenAI
  const aiRef = useRef<GoogleGenAI | null>(null);
  if (!aiRef.current && GOOGLE_API_KEY) {
    aiRef.current = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  }

  // Fetch Categories on Mount
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      // Load initial products
      performSearch('', '', '');
    }
  }, [isOpen]);

  // Reset selected images when product changes
  useEffect(() => {
     setSelectedImages([]);
  }, [selectedProduct]);

  // Derived state for available subcategories based on selected main category
  const availableSubCategories = useMemo(() => {
      if (!selectedCategory) return [];
      return categoryTree[selectedCategory] || [];
  }, [selectedCategory, categoryTree]);

  // Derived state for Main Categories (DB + Constants) to ensure "Audio" and others are always present
  const allMainCategories = useMemo(() => {
      // Merge DB categories with Constants to ensure complete list even if DB fetch is partial
      const combined = new Set([...mainCategories, ...PRODUCT_CATEGORIES]);
      const clean = Array.from(combined).filter(c => c && c.trim() !== '' && c !== 'Category');
      return clean.sort();
  }, [mainCategories]);

  const fetchCategories = async () => {
    // Only fetch if we haven't already populated the tree significantly
    if (Object.keys(categoryTree).length > 0) return;

    try {
      // 1. Ingestion: Fetch all distinct pairs (Limit 20,000 per spec)
      const { data, error } = await supabase
        .from('XD')
        .select('MainCategory, SubCategory')
        .neq('IsDiscontinued', true)
        .not('MainCategory', 'is', null)
        .neq('MainCategory', '') 
        .neq('MainCategory', 'Category') 
        .limit(20000); 

      if (error) throw error;

      if (data) {
        // 2. Transformation: Build Tree
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

        // Sort Main Categories
        const sortedMain = Object.keys(tree).sort();
        
        // Sort Subcategories within tree
        Object.keys(tree).forEach(key => {
            tree[key].sort();
        });

        setCategoryTree(tree);
        setMainCategories(sortedMain);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  // 3. Search Execution Pathways
  const performSearch = async (term: string, mainCatOverride?: string, subCatOverride?: string) => {
    setLoading(true);
    setError(null);
    setProducts([]);
    setSelectedProduct(null);

    const activeMainCat = mainCatOverride !== undefined ? mainCatOverride : selectedCategory;
    const activeSubCat = subCatOverride !== undefined ? subCatOverride : selectedSubCategory;

    try {
      let data: Product[] = [];

      // A. AI Semantic Search (Vector)
      if (isSemantic && term.trim().length > 0) {
        if (!aiRef.current) throw new Error("Google API Key is missing for semantic search.");

        // Generate Embedding
        const embedResult = await aiRef.current.models.embedContent({
            model: 'text-embedding-004',
            contents: { parts: [{ text: term }] } 
        });
        
        const embedding = embedResult.embeddings?.[0]?.values || embedResult.embedding?.values;

        if (!embedding) {
            throw new Error("Failed to generate embedding (no values returned).");
        }
        
        // Vector Match via RPC
        // Note: RPC handles MainCategory filtering via `category_filter`
        const { data: rpcData, error: rpcError } = await supabase.rpc('match_products', {
          query_embedding: embedding,
          match_threshold: 0.5,
          match_count: 100, // Increased to allow client-side filtering space
          category_filter: activeMainCat || null
        });

        if (rpcError) throw rpcError;
        
        data = rpcData || [];

        // Hybrid Refinement: Client-Side SubCategory Filter
        if (activeSubCat && data.length > 0) {
            data = data.filter(p => p.SubCategory === activeSubCat);
        }

      } else {
        // B. Standard SQL Search
        let query = supabase
          .from('XD')
          .select('ItemCode, ItemName, ItemName_sl, ItemName_hr, LongDescription, LongDescription_sl, LongDescription_hr, MainImage, AllImages, MainCategory, SubCategory, ItemPriceGross_Qty6')
          .neq('IsDiscontinued', true)
          .limit(1000); // Increased limit per spec to ensure categories like "Audio" (~300 items) are fully covered

        if (term.trim()) {
           query = query.or(`ItemName.ilike.%${term}%,ItemCode.ilike.%${term}%`);
        }

        if (activeMainCat) {
          query = query.eq('MainCategory', activeMainCat);
        }

        if (activeSubCat) {
           query = query.eq('SubCategory', activeSubCat);
        }

        const { data: textData, error: textError } = await query;
        if (textError) throw textError;
        data = textData || [];
      }

      setProducts(data);

    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchTerm);
  };

  // 4. Filtering Logic & State Synchronization
  const handleMainCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newVal = e.target.value;
      
      // Parent Change triggers reset of Child
      setSelectedCategory(newVal);
      setSelectedSubCategory(''); 
      
      // Trigger Search
      performSearch(searchTerm, newVal, '');
  };

  const handleSubCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newVal = e.target.value;
      setSelectedSubCategory(newVal);
      
      // Trigger Search
      performSearch(searchTerm, selectedCategory, newVal); 
  };

  const parseImages = (product: Product): string[] => {
     const images: string[] = [];
     if (product.MainImage) images.push(product.MainImage);
     
     if (product.AllImages) {
        const extras = product.AllImages.split(',').map(s => s.trim())
            .filter(s => s && s !== product.MainImage);
        images.push(...extras);
     }
     return images;
  };

  const toggleImageSelection = (imgUrl: string) => {
      setSelectedImages(prev => {
          if (prev.includes(imgUrl)) {
              return prev.filter(i => i !== imgUrl);
          } else {
              return [...prev, imgUrl];
          }
      });
  };

  const handleConfirmSelection = () => {
      if (selectedProduct) {
          onSelect(selectedImages, selectedProduct);
          onClose();
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl h-[80vh] bg-[#18181b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-[#18181b] z-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Package className="text-primary" size={24} /> 
              Product Catalog
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Search Controls */}
          <div className="flex gap-3 flex-col lg:flex-row">
             <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && performSearch(searchTerm)}
                        placeholder={isSemantic ? "Describe context (e.g. 'summer beach party')..." : "Search by name or code..."}
                        className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                    />
                </div>
                
                {/* Main Category Dropdown */}
                <select 
                   value={selectedCategory}
                   onChange={handleMainCategoryChange}
                   className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 w-full md:w-[200px]"
                >
                    <option value="" className="bg-[#18181b] text-white">All Categories</option>
                    {allMainCategories.map(cat => (
                        <option key={cat} value={cat} className="bg-[#18181b] text-white">{cat}</option>
                    ))}
                </select>

                {/* Sub Category Dropdown - Dependent & Controlled */}
                <select 
                   value={selectedSubCategory}
                   onChange={handleSubCategoryChange}
                   disabled={!selectedCategory || availableSubCategories.length === 0}
                   className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 w-full md:w-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <option value="" className="bg-[#18181b] text-white">
                        {availableSubCategories.length === 0 ? "No Subcategories" : "All Subcategories"}
                    </option>
                    {availableSubCategories.map(sub => (
                        <option key={sub} value={sub} className="bg-[#18181b] text-white">{sub}</option>
                    ))}
                </select>

                <button 
                    onClick={() => performSearch(searchTerm)}
                    className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:brightness-110 transition-all"
                >
                    Search
                </button>
             </div>
          </div>

          {/* Semantic Toggle */}
          <div className="flex items-center gap-2">
            <button 
                onClick={() => setIsSemantic(!isSemantic)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    isSemantic 
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-200' 
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}
            >
                <Sparkles size={12} className={isSemantic ? "text-purple-400" : ""} />
                AI Semantic Search
                <div className={`w-8 h-4 rounded-full relative ml-2 transition-colors ${isSemantic ? 'bg-purple-500' : 'bg-gray-600'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isSemantic ? 'left-4.5' : 'left-0.5'}`} />
                </div>
            </button>
            <span className="text-[10px] text-gray-500">
                {isSemantic ? "Using Gemini text-embedding-004 to find matching products by context." : "Exact match for SKU or Item Name."}
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex relative">
          
          {/* Main Grid List */}
          <div className={`flex-1 overflow-y-auto p-6 transition-all duration-300 ${selectedProduct ? 'w-full md:w-1/3 border-r border-white/5 hidden md:block' : 'w-full'}`}>
             
             {loading ? (
                 <div className="h-40 flex items-center justify-center flex-col gap-3">
                     <Loader2 className="animate-spin text-primary" size={32} />
                     <p className="text-sm text-gray-500">Searching catalog...</p>
                 </div>
             ) : error ? (
                 <div className="h-40 flex items-center justify-center flex-col gap-3">
                     <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">!</div>
                     <p className="text-sm text-red-400 text-center px-4">{error}</p>
                 </div>
             ) : products.length === 0 ? (
                 <div className="h-60 flex items-center justify-center flex-col gap-3 text-gray-500">
                     <Package size={48} className="opacity-20" />
                     <p>No products found.</p>
                 </div>
             ) : (
                <div className={`grid gap-4 ${selectedProduct ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                    {products.map((product) => (
                        <div 
                            key={product.ItemCode}
                            onClick={() => setSelectedProduct(product)}
                            className={`
                                group relative rounded-xl border overflow-hidden cursor-pointer transition-all hover:border-primary/50
                                ${selectedProduct?.ItemCode === product.ItemCode ? 'bg-white/5 border-primary ring-1 ring-primary' : 'bg-black/20 border-white/5'}
                            `}
                        >
                            <div className="aspect-square w-full bg-white p-4 relative">
                                <img 
                                    src={product.MainImage || ''} 
                                    alt={product.ItemName}
                                    className="w-full h-full object-contain mix-blend-multiply" 
                                    loading="lazy"
                                />
                                {/* Quick Select Overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                     <button className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-full transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                        View details
                                     </button>
                                </div>
                            </div>
                            <div className="p-3">
                                <div className="flex justify-between items-start gap-2">
                                    <h3 className="text-sm font-medium text-gray-200 line-clamp-1">{product.ItemName}</h3>
                                    <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-mono whitespace-nowrap">
                                        {product.ItemCode}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <p className="text-xs text-gray-500 truncate max-w-[60%]">{product.SubCategory || product.MainCategory}</p>
                                    {product.ItemPriceGross_Qty6 && (
                                        <p className="text-xs font-bold text-emerald-400">€{product.ItemPriceGross_Qty6.toFixed(2)}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             )}
          </div>

          {/* Product Detail & Lifestyle Selection */}
          {selectedProduct && (
              <div className={`flex-1 flex flex-col h-full bg-[#131315] absolute inset-0 md:relative z-20 md:z-0`}>
                  
                  {/* Detail Header - Static */}
                  <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-surfaceHighlight/50 backdrop-blur shrink-0">
                      <button 
                        onClick={() => setSelectedProduct(null)}
                        className="md:hidden p-2 hover:bg-white/10 rounded-full"
                      >
                          <ArrowLeft size={20} />
                      </button>
                      <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg truncate">{selectedProduct.ItemName}</h3>
                          <p className="text-xs text-gray-500">{selectedProduct.ItemCode}</p>
                      </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto">
                      
                      {/* Sticky Actions Header */}
                      <div className="sticky top-0 z-10 bg-[#131315]/95 backdrop-blur border-b border-white/5 px-6 py-4 flex items-center justify-between shadow-lg shadow-black/20">
                          <div className="text-sm font-semibold text-gray-200 uppercase tracking-wide flex items-center gap-2">
                              <ImageIcon size={14} className="text-primary" /> Select Images ({selectedImages.length})
                          </div>
                          
                          <button 
                              onClick={handleConfirmSelection}
                              className="px-4 py-2 bg-primary rounded-lg text-white text-xs font-bold hover:brightness-110 flex items-center gap-2 shadow-md transition-transform active:scale-95"
                          >
                              <Plus size={14} /> {selectedImages.length > 0 ? 'Add Selected' : 'Use Without Images'}
                          </button>
                      </div>

                      {/* Images Grid */}
                      <div className="p-6">
                          <div className="grid grid-cols-2 gap-4">
                              {parseImages(selectedProduct).map((imgUrl, idx) => {
                                  const isSelected = selectedImages.includes(imgUrl);
                                  return (
                                      <button 
                                        key={idx}
                                        onClick={() => toggleImageSelection(imgUrl)}
                                        className={`group relative aspect-square rounded-xl overflow-hidden border transition-all ${isSelected ? 'border-primary ring-2 ring-primary' : 'border-white/10 hover:border-white/30 bg-white'}`}
                                      >
                                          <img 
                                            src={imgUrl} 
                                            alt={`View ${idx + 1}`} 
                                            className="w-full h-full object-contain"
                                          />
                                          <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-primary text-white' : 'bg-black/20 text-transparent border border-white/30'}`}>
                                              <Check size={14} />
                                          </div>
                                      </button>
                                  );
                              })}
                              
                              {parseImages(selectedProduct).length === 0 && (
                                  <div className="col-span-2 py-10 text-center text-gray-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                                      No images available for this product.
                                  </div>
                              )}
                          </div>
                      </div>
                      
                      {/* Metadata */}
                      <div className="p-6 border-t border-white/5">
                         <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Details</h4>
                         <dl className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                            <div>
                               <dt className="text-gray-600">Main Category</dt>
                               <dd className="text-white">{selectedProduct.MainCategory}</dd>
                            </div>
                            <div>
                               <dt className="text-gray-600">Sub Category</dt>
                               <dd className="text-white">{selectedProduct.SubCategory}</dd>
                            </div>
                            <div>
                               <dt className="text-gray-600">Price (Qty 6+)</dt>
                               <dd className="text-white">{selectedProduct.ItemPriceGross_Qty6 ? `€${selectedProduct.ItemPriceGross_Qty6.toFixed(2)}` : 'N/A'}</dd>
                            </div>
                         </dl>
                      </div>
                  </div>

              </div>
          )}
          
        </div>

      </div>
    </div>
  );
}