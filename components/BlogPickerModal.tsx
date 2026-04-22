import React, { useEffect, useState } from 'react';
import { X, Search, FileText, Calendar, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { BlogPostRow } from '../types';

interface BlogPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (post: BlogPostRow) => void;
  primary: string;
  language: 'en' | 'sl' | 'hr';
}

export default function BlogPickerModal({ isOpen, onClose, onSelect, primary, language }: BlogPickerModalProps) {
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPosts();
      setSearchTerm('');
    }
  }, [isOpen]);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) setPosts(data as BlogPostRow[]);
    } catch (err: any) {
      console.error('Error fetching blog posts:', err);
      setError(err.message || 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = posts.filter(post => {
      const title = post[`title_${language}` as keyof BlogPostRow] || post.title_en;
      return title?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Helper to get localized content for display
  const getContent = (post: BlogPostRow) => {
      return {
          title: post[`title_${language}` as keyof BlogPostRow] || post.title_en,
          excerpt: post[`excerpt_${language}` as keyof BlogPostRow] || post.excerpt_en,
          date: new Date(post.published_at).toLocaleDateString()
      };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl h-[80vh] bg-[#18181b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-[#18181b] z-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="text-primary" size={24} /> 
              Select Blog Post
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
             <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search articles..."
                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
             />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#131315]">
            {loading ? (
                 <div className="h-40 flex items-center justify-center flex-col gap-3">
                     <Loader2 className="animate-spin text-primary" size={32} />
                     <p className="text-sm text-gray-500">Loading articles...</p>
                 </div>
            ) : error ? (
                 <div className="h-40 flex items-center justify-center flex-col gap-3">
                     <AlertCircle size={32} className="text-red-400" />
                     <p className="text-sm text-red-400">{error}</p>
                 </div>
            ) : filteredPosts.length === 0 ? (
                 <div className="h-40 flex items-center justify-center flex-col gap-3 text-gray-500">
                     <FileText size={32} className="opacity-20" />
                     <p>No published articles found.</p>
                 </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filteredPosts.map(post => {
                        const content = getContent(post);
                        return (
                            <button 
                                key={post.id}
                                onClick={() => { onSelect(post); onClose(); }}
                                className="flex gap-4 p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all text-left group"
                            >
                                <div className="w-24 h-24 shrink-0 rounded-lg bg-black overflow-hidden border border-white/10">
                                    {post.featured_image_url ? (
                                        <img src={post.featured_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-white/5">
                                            <FileText className="text-gray-600" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Published</span>
                                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                            <Calendar size={10} /> {content.date}
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-bold text-white mb-1 group-hover:text-primary transition-colors">{content.title}</h3>
                                    <p className="text-xs text-gray-400 line-clamp-2">{content.excerpt}</p>
                                </div>
                                <div className="flex items-center justify-center px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowRight className="text-white" size={20} />
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}