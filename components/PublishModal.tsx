import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Check, Send, Loader2 } from 'lucide-react';
import { PLATFORMS } from '../constants';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  primary: string;
}

export default function PublishModal({ isOpen, onClose, primary }: PublishModalProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishType, setPublishType] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state on open
      setSelectedPlatforms([]);
      setPublishType('now');
      setIsSuccess(false);
      setIsPublishing(false);
    }
  }, [isOpen]);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) return;
    setIsPublishing(true);
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsPublishing(false);
    setIsSuccess(true);
    setTimeout(() => {
        onClose();
    }, 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-[#18181b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {isSuccess ? (
           <div className="p-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                 <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                    <Check className="text-white w-7 h-7" strokeWidth={3} />
                 </div>
              </div>
              <h3 className="text-2xl font-bold text-white">Posted Successfully!</h3>
              <p className="text-gray-400">Your content is now live on {selectedPlatforms.length} platforms.</p>
           </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <h2 className="text-xl font-bold text-white">Publish Content</h2>
                <p className="text-sm text-gray-500 mt-1">Select channels and schedule</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8">
              {/* Platforms */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Platforms</label>
                <div className="grid grid-cols-2 gap-3">
                  {PLATFORMS.map(platform => {
                    const isSelected = selectedPlatforms.includes(platform.id);
                    return (
                      <button
                        key={platform.id}
                        onClick={() => togglePlatform(platform.id)}
                        className={`
                          flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 relative group
                          ${isSelected ? 'bg-white/5' : 'bg-transparent border-white/10 hover:border-white/20 hover:bg-white/5'}
                        `}
                        style={{ borderColor: isSelected ? primary : undefined }}
                      >
                         <span className="text-xl" style={{color: isSelected ? 'white' : '#9ca3af'}}>{platform.icon}</span>
                        <span className="text-sm font-medium text-white flex-1 text-left">{platform.name}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: primary }}>
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Timing */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">When to post</label>
                <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setPublishType('now')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${publishType === 'now' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                  >
                    <Send size={16} /> Publish Now
                  </button>
                  <button
                    onClick={() => setPublishType('schedule')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${publishType === 'schedule' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                  >
                    <Calendar size={16} /> Schedule
                  </button>
                </div>

                {publishType === 'schedule' && (
                  <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-medium ml-1">DATE</label>
                      <input 
                        type="date" 
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-medium ml-1">TIME</label>
                      <input 
                        type="time" 
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20" 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handlePublish}
                disabled={selectedPlatforms.length === 0 || isPublishing || (publishType === 'schedule' && (!scheduleDate || !scheduleTime))}
                className="flex-[2] py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98]"
                style={{ 
                   background: selectedPlatforms.length === 0 ? '#3f3f46' : `linear-gradient(135deg, ${primary} 0%, ${primary}dd 100%)`,
                   boxShadow: selectedPlatforms.length > 0 ? `0 4px 20px ${primary}40` : 'none'
                }}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Publishing...
                  </>
                ) : (
                  <>
                     {publishType === 'now' ? 'Publish Now' : 'Schedule Post'}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}