import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Clock, Loader2, AlertCircle, Folder, Send, Check } from 'lucide-react';
import { PLATFORMS } from '../constants';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, scheduledAt: string | null, folder: string | null) => Promise<void>;
  initialName?: string;
  initialDate?: string | null;
  initialFolder?: string | null;
  primary?: string;
}

export default function SaveModal({ isOpen, onClose, onSave, initialName = '', initialDate = null, initialFolder = null, primary = '#e71e86' }: SaveModalProps) {
  const [name, setName] = useState(initialName);
  const [folder, setFolder] = useState(initialFolder || '');
  const [existingFolders, setExistingFolders] = useState<string[]>([]);
  
  // Publish/Schedule State
  const [isPublishing, setIsPublishing] = useState(!!initialDate);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSqlFix, setShowSqlFix] = useState(false);
  const [sqlType, setSqlType] = useState<'table' | 'storage'>('table');

  useEffect(() => {
    if (isOpen) {
      setName(initialName || `Project ${new Date().toLocaleDateString()}`);
      setFolder(initialFolder || '');
      setError(null);
      setShowSqlFix(false);
      
      // Load folders from local storage for suggestions
      const savedFolders = localStorage.getItem('socialframe_folders');
      if (savedFolders) {
          try {
              setExistingFolders(JSON.parse(savedFolders));
          } catch (e) { console.error(e); }
      }

      if (initialDate) {
          const d = new Date(initialDate);
          setDate(d.toISOString().split('T')[0]);
          setTime(d.toTimeString().slice(0, 5));
          setIsPublishing(true);
      } else {
          setIsPublishing(false);
          setDate('');
          setTime('');
          setSelectedPlatforms([]);
      }
    }
  }, [isOpen, initialName, initialDate, initialFolder]);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    setError(null);
    setShowSqlFix(false);

    try {
        let scheduledAt = null;
        if (isPublishing && date && time) {
            scheduledAt = new Date(`${date}T${time}`).toISOString();
        }
        
        // Save logic handles basic project data
        // For now, platform selection isn't persisted to DB in this demo, 
        // but typically you'd add a 'platforms' column to the 'projects' table.
        await onSave(name, scheduledAt, folder || null);
        
        // Update local folder history if new
        if (folder && !existingFolders.includes(folder)) {
             const newFolders = [...existingFolders, folder].sort();
             localStorage.setItem('socialframe_folders', JSON.stringify(newFolders));
        }

        onClose();
    } catch (error: any) {
        console.error("Save error in modal:", error);
        
        if (error.message?.includes('column') || error.message?.includes('relation') || error.code === 'PGRST204') {
            setShowSqlFix(true);
            setSqlType('table');
            setError("Database schema mismatch. Please run the SQL below in Supabase SQL Editor.");
        } else if (error.message?.includes('violates row-level security policy') || error.message?.includes('Storage Error')) {
            setShowSqlFix(true);
            setSqlType('storage');
            setError("Storage permission error. You need to enable public uploads in Supabase.");
        } else {
            setError(error.message || "Failed to save project");
        }
    } finally {
        setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-[#18181b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Save size={20} className="text-primary" />
            Save & Schedule
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-400 font-bold">{error}</p>
                    </div>
                    {showSqlFix && (
                        <div className="mt-3 bg-black/40 p-3 rounded-lg border border-yellow-500/30 relative group">
                             <p className="text-[10px] text-yellow-400 mb-2 font-bold uppercase tracking-wider">Run this SQL in Supabase:</p>
                             <pre className="text-[10px] bg-black p-2 rounded text-gray-300 overflow-x-auto border border-white/10 font-mono whitespace-pre-wrap">
{sqlType === 'table' ? `alter table projects add column if not exists slides jsonb;
alter table projects add column if not exists scheduled_at timestamptz;
alter table projects add column if not exists status text default 'draft';
alter table projects add column if not exists folder text;
alter table projects add column if not exists generated_assets jsonb DEFAULT '{}';
alter table projects add column if not exists post_texts jsonb DEFAULT '{}';
alter table projects add column if not exists links jsonb DEFAULT '{}';` 
: 
`-- Allow public uploads to 'scheduled-assets' bucket
insert into storage.buckets (id, name, public) values ('scheduled-assets', 'scheduled-assets', true) on conflict do nothing;
create policy "Public Uploads" on storage.objects for insert to public with check (bucket_id = 'scheduled-assets');
create policy "Public Select" on storage.objects for select to public using (bucket_id = 'scheduled-assets');
create policy "Public Update" on storage.objects for update to public using (bucket_id = 'scheduled-assets');`}
                             </pre>
                        </div>
                    )}
                </div>
            )}

            {/* General Info */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Project Name</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter project name..."
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                        autoFocus
                    />
                </div>
                
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Folder size={12} /> Folder (Optional)
                    </label>
                    <div className="relative">
                         <input 
                            type="text"
                            list="folder-suggestions"
                            value={folder}
                            onChange={(e) => setFolder(e.target.value)}
                            placeholder="Select or create folder..."
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                         />
                         <datalist id="folder-suggestions">
                             {existingFolders.map(f => (
                                 <option key={f} value={f} />
                             ))}
                         </datalist>
                    </div>
                </div>
            </div>

            {/* Scheduling Toggle */}
            <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${isPublishing ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-400'}`}>
                             <Send size={16} />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white">Publish / Schedule</div>
                            <div className="text-xs text-gray-500">Plan content for social platforms</div>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setIsPublishing(!isPublishing)}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${isPublishing ? 'bg-primary' : 'bg-white/10'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow-sm ${isPublishing ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                {/* Publishing Options */}
                {isPublishing && (
                    <div className="space-y-6 animate-in slide-in-from-top-2">
                        
                        {/* Platforms */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Destinations</label>
                            <div className="grid grid-cols-2 gap-2">
                                {PLATFORMS.map(platform => {
                                    const isSelected = selectedPlatforms.includes(platform.id);
                                    return (
                                    <button
                                        type="button"
                                        key={platform.id}
                                        onClick={() => togglePlatform(platform.id)}
                                        className={`
                                        flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-200 relative
                                        ${isSelected ? 'bg-white/5' : 'bg-transparent border-white/10 hover:border-white/20 hover:bg-white/5'}
                                        `}
                                        style={{ borderColor: isSelected ? primary : undefined }}
                                    >
                                        <span className="text-lg" style={{color: isSelected ? 'white' : '#9ca3af'}}>{platform.icon}</span>
                                        <span className="text-xs font-medium text-white flex-1 text-left">{platform.name}</span>
                                        {isSelected && <Check size={12} className="text-white" />}
                                    </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Date/Time */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-medium ml-1 flex items-center gap-1"><Calendar size={10} /> DATE</label>
                                <input 
                                    type="date" 
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-medium ml-1 flex items-center gap-1"><Clock size={10} /> TIME</label>
                                <input 
                                    type="time" 
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20" 
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-3 pt-2">
                <button 
                    type="submit"
                    disabled={!name.trim() || isSaving || (isPublishing && (!date || !time))}
                    className="flex-1 py-3.5 bg-primary hover:brightness-110 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                         <><Loader2 className="animate-spin" size={16} /> Saving...</>
                    ) : isPublishing ? (
                         <><Calendar size={16} /> Schedule & Save</>
                    ) : (
                         <><Save size={16} /> Save Draft</>
                    )}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}