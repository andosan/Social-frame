import React, { useState, useRef } from 'react';
import { X, Sparkles, Calendar, Globe, Loader2, Check, LayoutTemplate, ArrowRight, Save } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { BannerConfig, CalendarItem, LayoutType } from '../types';
import { DEFAULT_CONFIG, SAMPLE_IMAGES } from '../constants';
import { supabase } from '../supabase';

interface AiPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadConfig: (config: BannerConfig) => void;
}

// Get API Key
const GOOGLE_API_KEY = process.env.API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY || '';

export default function AiPlannerModal({ isOpen, onClose, onLoadConfig }: AiPlannerModalProps) {
  const [step, setStep] = useState<'input' | 'planning' | 'review'>('input');
  const [loading, setLoading] = useState(false);
  
  // Inputs
  const [context, setContext] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [month, setMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
  
  // Data
  const [plan, setPlan] = useState<CalendarItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);

  const aiRef = useRef<GoogleGenAI | null>(null);
  if (!aiRef.current && GOOGLE_API_KEY) {
    aiRef.current = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  }

  // 1. Generate High Level Plan
  const generatePlan = async () => {
    if (!context) return;
    setLoading(true);
    
    try {
        const prompt = `
            Act as a social media manager. Generate a content calendar for:
            Brand Context: ${context}
            Target Audience: ${targetAudience}
            Month: ${month}
            
            Generate 5 distinct post ideas.
            Return ONLY valid JSON array with objects:
            {
                "date": "YYYY-MM-DD",
                "topic": "Short topic title",
                "type": "post" or "story",
                "visualPrompt": "Description of the image needed",
                "suggestedLayout": "standard" or "grid" or "image" or "brand"
            }
        `;

        const response = await aiRef.current?.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
        });

        const text = response?.text;
        if (text) {
            const data = JSON.parse(text);
            // Initialize with draft status
            setPlan(data.map((item: any) => ({ ...item, status: 'draft' })));
            setStep('planning');
        }
    } catch (e) {
        console.error(e);
        alert('Failed to generate plan');
    } finally {
        setLoading(false);
    }
  };

  // 2. Generate Details (Captions + Design) for a specific item
  const generateDetails = async (item: CalendarItem, index: number) => {
      setLoading(true);
      try {
          const prompt = `
            For a social media post about: "${item.topic}" (${item.visualPrompt}).
            Brand Context: ${context}
            
            1. Write engaging captions in Slovenian (sl), English (en), and Croatian (hr).
            2. Suggest hashtags.
            3. Define design parameters for my design tool.
            
            Return ONLY valid JSON:
            {
                "captions": { "sl": "...", "en": "...", "hr": "..." },
                "hashtags": ["#tag1", "#tag2"],
                "design": {
                    "heading": "Catchy headline (max 5 words)",
                    "subtitle": "Short subtitle (max 10 words)",
                    "primaryColor": "Hex color code matching the mood",
                    "cta": "Call to action text"
                }
            }
          `;
          
          const response = await aiRef.current?.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
          });

          const text = response?.text;
          if (text) {
              const data = JSON.parse(text);
              
              // Create the BannerConfig object
              const newConfig: BannerConfig = {
                  ...DEFAULT_CONFIG,
                  id: Math.random().toString(36).substr(2, 9),
                  layout: item.suggestedLayout,
                  format: item.type === 'story' ? 'story' : 'square',
                  theme: {
                      primaryColor: data.design.primaryColor || '#e71e86',
                      textColor: '#ffffff'
                  },
                  content: {
                      ...DEFAULT_CONFIG.content,
                      heading: data.design.heading,
                      subtitle: data.design.subtitle,
                      cta: { ...DEFAULT_CONFIG.content.cta, text: data.design.cta || 'Learn More' },
                      // Randomly pick a sample image for now, real app would use Google Search/Image Gen
                      grid: { images: [SAMPLE_IMAGES[0], SAMPLE_IMAGES[1]], gap: 20 } 
                  },
                  background: {
                      image: SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)],
                      brightness: 60
                  }
              };

              const updatedItem: CalendarItem = {
                  ...item,
                  captions: data.captions,
                  hashtags: data.hashtags,
                  designConfig: newConfig,
                  status: 'generated'
              };

              // Update list
              const newPlan = [...plan];
              newPlan[index] = updatedItem;
              setPlan(newPlan);
              setSelectedItem(updatedItem);
          }
      } catch (e) {
          console.error(e);
          alert('Failed to generate details');
      } finally {
          setLoading(false);
      }
  };

  const handleLoadToEditor = () => {
      if (selectedItem?.designConfig) {
          onLoadConfig(selectedItem.designConfig);
          onClose();
      }
  };

  const handleSaveToDatabase = async () => {
     if (!selectedItem) return;
     setLoading(true);
     try {
         const { error } = await supabase.from('content_calendar').insert({
             scheduled_date: selectedItem.date,
             topic: selectedItem.topic,
             content_type: selectedItem.type,
             captions: selectedItem.captions,
             hashtags: selectedItem.hashtags,
             design_config: selectedItem.designConfig,
             status: 'draft',
             platform: ['instagram', 'facebook'] // Default
         });
         
         if (error) throw error;
         alert('Saved to Calendar Database!');
         
         // Mark as scheduled in local state
         const newPlan = plan.map(p => p.topic === selectedItem.topic ? { ...p, status: 'scheduled' as const } : p);
         setPlan(newPlan);
         
     } catch (e: any) {
         console.error(e);
         alert('Database Error: ' + e.message);
     } finally {
         setLoading(false);
     }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl h-[85vh] bg-[#18181b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-surfaceHighlight/20">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Sparkles className="text-purple-400" size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white">AI Content Planner</h2>
                    <p className="text-xs text-gray-400">Generate, Translate, Design, Schedule</p>
                </div>
            </div>
            <button onClick={onClose}><X className="text-gray-400 hover:text-white" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* Sidebar / List */}
            <div className="w-1/3 border-r border-white/5 flex flex-col bg-black/20">
                {step === 'input' && (
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Context / Niche</label>
                            <textarea 
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white mt-1 h-24"
                                placeholder="e.g. A boutique coffee shop in Ljubljana specializing in cold brew..."
                                value={context}
                                onChange={e => setContext(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Target Audience</label>
                            <input 
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white mt-1"
                                placeholder="e.g. Students and remote workers, age 20-35"
                                value={targetAudience}
                                onChange={e => setTargetAudience(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={generatePlan}
                            disabled={loading || !context}
                            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />}
                            Generate Plan
                        </button>
                    </div>
                )}

                {step === 'planning' && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {plan.map((item, idx) => (
                            <div 
                                key={idx}
                                onClick={() => item.status !== 'draft' && setSelectedItem(item)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                    selectedItem?.topic === item.topic 
                                    ? 'bg-purple-500/10 border-purple-500/50' 
                                    : 'bg-white/5 border-white/5 hover:border-white/20'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-mono text-gray-500">{item.date}</span>
                                    {item.status === 'draft' ? (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); generateDetails(item, idx); }}
                                            className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded flex items-center gap-1"
                                        >
                                            {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} Generate
                                        </button>
                                    ) : (
                                        <span className="text-xs text-green-400 flex items-center gap-1"><Check size={10} /> Ready</span>
                                    )}
                                </div>
                                <h4 className="font-bold text-sm text-white">{item.topic}</h4>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-gray-400 uppercase">{item.type}</span>
                                    <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-gray-400 uppercase">{item.suggestedLayout}</span>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setStep('input')} className="text-xs text-center w-full text-gray-500 hover:text-white py-2">
                            Start Over
                        </button>
                    </div>
                )}
            </div>

            {/* Main Preview Area */}
            <div className="flex-1 bg-[#131315] p-8 overflow-y-auto">
                {!selectedItem ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600">
                        <Calendar size={48} className="mb-4 opacity-20" />
                        <p>Select or generate a post from the list to view details.</p>
                    </div>
                ) : (
                    <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right-4">
                        
                        {/* Translations */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                                <Globe size={16} /> Captions
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                                {['sl', 'en', 'hr'].map((lang) => (
                                    <div key={lang} className="bg-black/20 p-4 rounded-xl border border-white/5">
                                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">{lang}</div>
                                        <p className="text-sm text-gray-300 leading-relaxed">
                                            {selectedItem.captions?.[lang as keyof typeof selectedItem.captions]}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <div className="text-xs text-purple-400 font-mono">
                                {selectedItem.hashtags?.join(' ')}
                            </div>
                        </div>

                        {/* Design Config Preview info */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                                <LayoutTemplate size={16} /> Visual Strategy
                            </h3>
                            <div className="bg-black/20 p-6 rounded-xl border border-white/5 flex gap-6 items-center">
                                <div className="flex-1 space-y-2">
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-sm text-gray-400">Headline</span>
                                        <span className="text-sm text-white font-medium">{selectedItem.designConfig?.content.heading}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-sm text-gray-400">Layout</span>
                                        <span className="text-sm text-white font-medium capitalize">{selectedItem.designConfig?.layout}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-400">Color</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ background: selectedItem.designConfig?.theme.primaryColor }} />
                                            <span className="text-sm text-white font-mono">{selectedItem.designConfig?.theme.primaryColor}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-32 h-32 bg-white/5 rounded-lg flex items-center justify-center text-xs text-center text-gray-500 p-2">
                                    Visual Reference: <br/> "{item => item.visualPrompt}"
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 border-t border-white/5">
                            <button 
                                onClick={handleLoadToEditor}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all"
                            >
                                <LayoutTemplate size={18} /> Load to Editor
                            </button>
                            <button 
                                onClick={handleSaveToDatabase}
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20"
                            >
                                <Save size={18} /> Save to Scheduler
                            </button>
                        </div>

                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
}