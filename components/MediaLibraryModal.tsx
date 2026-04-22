import React, { useEffect, useState, useRef } from 'react';
import { X, Cloud, Upload, Check, Loader2, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase, STORAGE_BUCKET } from '../supabase';

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  primary: string;
}

interface CloudImage {
  name: string;
  url: string;
  created_at: string;
}

export default function MediaLibraryModal({ isOpen, onClose, onSelect, primary }: MediaLibraryModalProps) {
  const [images, setImages] = useState<CloudImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if credentials exist
  const hasCredentials = (supabase as any).supabaseUrl && (supabase as any).supabaseKey;

  const fetchImages = async () => {
    if (!hasCredentials) return;
    
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      if (error) throw error;

      if (data) {
        const imageList = data
          .filter(file => file.name !== '.emptyFolderPlaceholder') // Filter out placeholders
          .map(file => {
            const { data: { publicUrl } } = supabase.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(file.name);
            
            return {
              name: file.name,
              url: publicUrl,
              created_at: file.created_at,
            };
          });
        setImages(imageList);
      }
    } catch (err: any) {
      console.error('Error fetching images:', err);
      setError(err.message || 'Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [isOpen]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Refresh list
      await fetchImages();
    } catch (err: any) {
      console.error('Error uploading:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (imageName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([imageName]);

      if (error) throw error;
      setImages(prev => prev.filter(img => img.name !== imageName));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[#18181b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#18181b] z-10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Cloud className="text-primary" size={24} /> 
              Cloud Library
            </h2>
            <p className="text-sm text-gray-500 mt-1">Select images from your Supabase storage</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
          
          {!hasCredentials ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 p-8 border border-dashed border-white/10 rounded-xl">
              <AlertCircle size={48} className="text-gray-600"