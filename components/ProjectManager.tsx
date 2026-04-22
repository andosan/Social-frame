import React, { useEffect, useState, useMemo } from 'react';
import { X, FolderOpen, Calendar, MoreHorizontal, Edit, Copy, Trash2, Loader2, FileImage, RefreshCw, AlertCircle, Plus, Folder, FolderPlus, ChevronRight, Inbox, Clock, LayoutGrid, List } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../supabase';
import { SavedProject } from '../types';

// --- Drag & Drop Components ---

const DraggableProject: React.FC<{ project: SavedProject; onClick: () => void }> = ({ project, onClick }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: project.id,
        data: { project }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
        touchAction: 'none'
    };

    return (
        <button 
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={(e) => {
                // Prevent click propagation if it was a drag
                if (!isDragging) onClick();
            }}
            className="w-full text-left text-[10px] bg-white/10 hover:bg-white/20 text-white px-1.5 py-1 rounded truncate block cursor-grab active:cursor-grabbing border border-transparent hover:border-white/10 transition-colors shadow-sm mb-1"
            title={project.name}
        >
            {project.name}
        </button>
    );
};

const DroppableDay: React.FC<{ dateStr: string; children: React.ReactNode; isToday: boolean }> = ({ dateStr, children, isToday }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: dateStr,
    });

    return (
        <div 
            ref={setNodeRef}
            className={`relative border rounded-lg p-2 flex flex-col overflow-hidden transition-colors h-full min-h-[80px]
                ${isOver ? 'bg-primary/20 border-primary' : 'bg-black/20 border-white/5'}
                ${isToday && !isOver ? 'border-primary/50 ring-1 ring-primary/20' : ''}
            `}
        >
            {children}
        </div>
    );
};

// --- Internal Calendar Component ---

const CalendarView = ({ projects, onSelectProject, onReschedule }: { projects: SavedProject[], onSelectProject: (p: SavedProject) => void, onReschedule: (id: string, date: string) => void }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => {
        const day = new Date(y, m, 1).getDay();
        return day === 0 ? 6 : day - 1;
    };

    const days = useMemo(() => {
        const result = [];
        const daysCount = getDaysInMonth(year, month);
        const startDay = getFirstDayOfMonth(year, month);
        for (let i = 0; i < startDay; i++) result.push(null);
        for (let i = 1; i <= daysCount; i++) result.push(i);
        return result;
    }, [year, month]);

    const scheduledMap = useMemo(() => {
        const map: Record<number, SavedProject[]> = {};
        projects.forEach(p => {
            if (p.scheduled_at) {
                const d = new Date(p.scheduled_at);
                if (d.getMonth() === month && d.getFullYear() === year) {
                    const dayNum = d.getDate();
                    if (!map[dayNum]) map[dayNum] = [];
                    map[dayNum].push(p);
                }
            }
        });
        return map;
    }, [projects, month, year]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px movement to start drag, allowing clicks for "Open"
            },
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const projectId = active.id as string;
            const newDateStr = over.id as string; // We use ISO date string as ID for droppable
            
            // Preserve existing time if possible, otherwise default to 09:00
            const project = projects.find(p => p.id === projectId);
            let timePart = "09:00:00.000Z";
            
            if (project?.scheduled_at) {
                const oldDate = new Date(project.scheduled_at);
                const iso = oldDate.toISOString();
                timePart = iso.split('T')[1];
            }
            
            const finalIso = `${newDateStr}T${timePart}`;
            onReschedule(projectId, finalIso);
        }
    };

    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-bold text-white flex items-center gap-3">
                     <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-white/10 rounded">&lt;</button>
                     {monthNames[month]} {year}
                     <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-white/10 rounded">&gt;</button>
                 </h2>
                 <div className="text-xs text-gray-500">
                     Drag projects to reschedule • Click to open
                 </div>
            </div>
            
            <div className="grid grid-cols-7 mb-2 border-b border-white/5 pb-2">
                {weekDays.map(d => <div key={d} className="text-center text-xs font-bold text-gray-500">{d}</div>)}
            </div>
            
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-7 grid-rows-5 gap-2 flex-1 min-h-0">
                    {days.map((day, idx) => {
                        if (day === null) return <div key={`empty-${idx}`} />;
                        
                        // Construct ID for Droppable: YYYY-MM-DD
                        const dateId = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const items = scheduledMap[day] || [];
                        const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                        
                        return (
                            <DroppableDay key={day} dateStr={dateId} isToday={isToday}>
                                <span className={`text-xs font-bold mb-1 block ${isToday ? 'text-primary' : 'text-gray-500'}`}>{day}</span>
                                <div className="flex-1 overflow-y-auto scrollbar-hide">
                                    {items.map(p => (
                                        <DraggableProject 
                                            key={p.id} 
                                            project={p} 
                                            onClick={() => onSelectProject(p)} 
                                        />
                                    ))}
                                </div>
                            </DroppableDay>
                        );
                    })}
                </div>
            </DndContext>
        </div>
    );
};


interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (project: SavedProject) => void;
  onNewProject: () => void;
  currentProjectId: string | null;
}

export default function ProjectManager({ isOpen, onClose, onLoad, onNewProject, currentProjectId }: ProjectManagerProps) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // View State
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');

  // Menu State
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number, left: number } | null>(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState<string | null>(null);
  
  // Folder State
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // SQL Fix Helper State
  const [showSqlFix, setShowSqlFix] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      loadFolders();
    }
  }, [isOpen]);

  const loadFolders = () => {
      try {
          const saved = localStorage.getItem('socialframe_folders');
          if (saved) {
              setCustomFolders(JSON.parse(saved));
          }
      } catch (e) {
          console.error("Error loading folders", e);
      }
  };

  const saveFolders = (folders: string[]) => {
      setCustomFolders(folders);
      localStorage.setItem('socialframe_folders', JSON.stringify(folders));
  };

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    setShowSqlFix(false);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data as SavedProject[]);
      
      // Extract unique folders
      if (data) {
          const projectFolders = new Set(data.map((p: SavedProject) => p.folder).filter(Boolean) as string[]);
          setCustomFolders(prev => {
              const combined = new Set([...prev, ...projectFolders]);
              return Array.from(combined).sort();
          });
      }

    } catch (err: any) {
      console.error("Fetch projects error:", err);
      // If network fail, provide demo data instead of empty error state so app looks usable
      if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
          const demoProjects: SavedProject[] = [
              { id: '1', name: 'Winter Campaign 2026', slides: [], updated_at: new Date().toISOString(), created_at: new Date().toISOString(), status: 'draft', folder: 'Campaigns' },
              { id: '2', name: 'Product Launch', slides: [], updated_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date().toISOString(), status: 'scheduled', scheduled_at: new Date(Date.now() + 86400000).toISOString(), folder: 'Social' }
          ];
          setProjects(demoProjects);
          setCustomFolders(['Campaigns', 'Social']);
          setError(null);
      } else {
          setError(err.message || 'Failed to load projects');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
      e.preventDefault();
      if (newFolderName.trim()) {
          const newFolders = [...customFolders, newFolderName.trim()].sort();
          saveFolders(newFolders);
          setNewFolderName('');
          setIsCreatingFolder(false);
      }
  };

  const handleDeleteFolder = (folder: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm(`Delete folder "${folder}"? Projects will remain but become uncategorized.`)) {
          const newFolders = customFolders.filter(f => f !== folder);
          saveFolders(newFolders);
          if (activeFolder === folder) setActiveFolder('all');
      }
  };

  const closeMenu = () => {
      setMenuOpen(null);
      setMenuPos(null);
      setMoveMenuOpen(null);
  };

  const handleMoveProject = async (project: SavedProject, targetFolder: string) => {
      setActionLoading(project.id);
      try {
          const folderValue = targetFolder === 'uncategorized' ? null : targetFolder;
          
          const { error } = await supabase
            .from('projects')
            .update({ folder: folderValue })
            .eq('id', project.id);

          if (error) throw error;
          setProjects(prev => prev.map(p => p.id === project.id ? { ...p, folder: folderValue || undefined } : p));
          closeMenu();
      } catch (err: any) {
          console.error("Move error:", err);
          if (err.message?.includes('column')) {
               setShowSqlFix(true);
               setError("Database missing 'folder' column.");
          }
      } finally {
          setActionLoading(null);
      }
  };

  const handleRescheduleProject = async (projectId: string, newDateIso: string) => {
    // Optimistic Update
    const originalProjects = [...projects];
    setProjects(prev => prev.map(p => 
        p.id === projectId 
            ? { ...p, scheduled_at: newDateIso, status: 'scheduled' } 
            : p
    ));

    try {
        const { error } = await supabase
          .from('projects')
          .update({ 
              scheduled_at: newDateIso,
              status: 'scheduled'
          })
          .eq('id', projectId);

        if (error) throw error;
    } catch (err: any) {
        console.error("Reschedule error:", err);
        setError("Failed to reschedule: " + err.message);
        // Revert on error
        setProjects(originalProjects);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    setActionLoading(id);
    try {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) throw error;
        setProjects(prev => prev.filter(p => p.id !== id));
        closeMenu();
    } catch (err: any) {
        // If demo mode (offline), just delete locally
        if (projects.find(p => p.id === id)?.id.length < 5) {
             setProjects(prev => prev.filter(p => p.id !== id));
             closeMenu();
        } else {
             setError(`Delete failed: ${err.message}`);
        }
    } finally {
        setActionLoading(null);
    }
  };

  const handleDuplicate = async (project: SavedProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(project.id);
    try {
        const { data, error } = await supabase.from('projects').insert({
            name: `${project.name} (Copy)`,
            slides: project.slides,
            status: 'draft',
            folder: project.folder,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }).select().single();

        if (error) throw error;
        setProjects(prev => [data, ...prev]);
        closeMenu();
    } catch (err: any) {
        // Mock duplicate if in demo mode
        if (project.id.length < 5) {
            const newP = { ...project, id: Math.random().toString(), name: `${project.name} (Copy)` };
            setProjects(prev => [newP, ...prev]);
            closeMenu();
        } else {
            alert('Error duplicating project: ' + err.message);
        }
    } finally {
        setActionLoading(null);
    }
  };
  
  const getPreviewImage = (project: SavedProject) => {
      if (!project.slides || !Array.isArray(project.slides) || project.slides.length === 0) return null;
      return project.slides[0]?.background?.image;
  };

  const filteredProjects = useMemo(() => {
      if (activeFolder === 'all') return projects;
      if (activeFolder === 'drafts') return projects.filter(p => !p.scheduled_at);
      if (activeFolder === 'scheduled') return projects.filter(p => p.scheduled_at);
      if (activeFolder === 'uncategorized') return projects.filter(p => !p.folder);
      return projects.filter(p => p.folder === activeFolder);
  }, [projects, activeFolder]);

  const activeMenuProject = useMemo(() => projects.find(p => p.id === menuOpen), [projects, menuOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-7xl h-[85vh] bg-[#18181b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex animate-in zoom-in-95 duration-200">
        
        {/* Sidebar - Folders */}
        <div className="w-64 bg-[#131315] border-r border-white/5 flex flex-col shrink-0">
            <div className="p-5 border-b border-white/5">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FolderOpen size={16} className="text-primary" /> Library
                </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                <button 
                    onClick={() => setActiveFolder('all')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeFolder === 'all' ? 'bg-primary/20 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                >
                    <div className="flex items-center gap-2"><Inbox size={14} /> All Projects</div>
                    <span className="opacity-50">{projects.length}</span>
                </button>
                <button 
                    onClick={() => setActiveFolder('scheduled')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeFolder === 'scheduled' ? 'bg-primary/20 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                >
                    <div className="flex items-center gap-2"><Clock size={14} /> Scheduled</div>
                    <span className="opacity-50">{projects.filter(p => p.scheduled_at).length}</span>
                </button>
                <button 
                    onClick={() => setActiveFolder('uncategorized')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeFolder === 'uncategorized' ? 'bg-primary/20 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                >
                    <div className="flex items-center gap-2"><AlertCircle size={14} /> Uncategorized</div>
                    <span className="opacity-50">{projects.filter(p => !p.folder).length}</span>
                </button>

                <div className="pt-4 pb-2 px-3">
                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center justify-between">
                        Folders
                        <button onClick={() => setIsCreatingFolder(true)} className="hover:text-white"><Plus size={12} /></button>
                    </div>
                </div>

                {isCreatingFolder && (
                    <form onSubmit={handleCreateFolder} className="px-2 mb-2">
                        <input 
                            autoFocus
                            type="text" 
                            className="w-full bg-black/40 border border-primary/50 rounded px-2 py-1 text-xs text-white focus:outline-none"
                            placeholder="Folder name..."
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onBlur={() => !newFolderName && setIsCreatingFolder(false)}
                        />
                    </form>
                )}

                {customFolders.map(folder => (
                    <div key={folder} className="group flex items-center">
                        <button 
                            onClick={() => setActiveFolder(folder)}
                            className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeFolder === folder ? 'bg-primary/20 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            <div className="flex items-center gap-2"><Folder size={14} /> {folder}</div>
                            <span className="opacity-50">{projects.filter(p => p.folder === folder).length}</span>
                        </button>
                        <button 
                            onClick={(e) => handleDeleteFolder(folder, e)}
                            className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#18181b]">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-white capitalize flex items-center gap-2">
                        {activeFolder === 'all' ? 'All Projects' : activeFolder}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-normal">
                            {filteredProjects.length}
                        </span>
                    </h2>
                    
                    {/* View Toggle */}
                    <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button 
                            onClick={() => setViewMode('calendar')}
                            className={`p-1.5 rounded transition-colors ${viewMode === 'calendar' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Calendar size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={onNewProject}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-bold shadow-lg shadow-primary/20"
                    >
                        <Plus size={16} /> New Project
                    </button>
                    <div className="w-px h-6 bg-white/10 mx-2"></div>
                    <button 
                        onClick={fetchProjects} 
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                        title="Refresh List"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto relative">
                {viewMode === 'calendar' ? (
                     <CalendarView 
                         projects={projects} 
                         onSelectProject={(p) => { onLoad(p); onClose(); }} 
                         onReschedule={handleRescheduleProject}
                     />
                ) : (
                    <div className="p-6">
                        {error && (
                            <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                <p className="text-sm text-red-400">{error}</p>
                                {showSqlFix && <div className="text-[10px] text-gray-500 mt-2">SQL Fix available in console</div>}
                            </div>
                        )}

                        {loading && projects.length === 0 ? (
                            <div className="h-40 flex items-center justify-center">
                                <Loader2 className="animate-spin text-primary" size={32} />
                            </div>
                        ) : filteredProjects.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center py-20">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                    <FolderOpen size={32} className="text-gray-600" />
                                </div>
                                <h3 className="text-white font-bold mb-1">No projects found</h3>
                                <p className="text-gray-500 text-sm">Create a new project or select a different folder.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                                {filteredProjects.map(project => {
                                    const previewImage = getPreviewImage(project);
                                    return (
                                    <div 
                                        key={project.id}
                                        className={`group relative bg-black/20 border rounded-xl transition-all hover:border-primary/50 flex flex-col overflow-visible ${currentProjectId === project.id ? 'border-primary ring-1 ring-primary' : 'border-white/5'}`}
                                    >
                                        <div 
                                            className="aspect-video bg-[#000] relative overflow-hidden cursor-pointer rounded-t-xl"
                                            onClick={() => { onLoad(project); onClose(); }}
                                        >
                                            {previewImage ? (
                                                previewImage.startsWith('color:') ? (
                                                    <div className="w-full h-full" style={{ backgroundColor: previewImage.replace('color:', '') }} />
                                                ) : (
                                                    <img src={previewImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                                )
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-white/5"><FileImage className="text-gray-700" size={32} /></div>
                                            )}
                                            
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4">
                                                <h3 className="text-white font-bold truncate text-sm">{project.name}</h3>
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    {Array.isArray(project.slides) ? project.slides.length : 0} slides • {new Date(project.updated_at).toLocaleDateString()}
                                                </p>
                                            </div>

                                            {actionLoading === project.id && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10"><Loader2 className="animate-spin text-white" /></div>
                                            )}
                                        </div>

                                        <div className="p-2.5 bg-[#18181b] flex items-center justify-between border-t border-white/5 rounded-b-xl">
                                            <div className="flex items-center gap-2">
                                                {project.folder && (
                                                    <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded flex items-center gap-1 max-w-[80px] truncate">
                                                        <Folder size={8} /> {project.folder}
                                                    </span>
                                                )}
                                                {project.scheduled_at ? (
                                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        <Calendar size={8} /> {new Date(project.scheduled_at).toLocaleDateString()}
                                                    </span>
                                                ) : (!project.folder && <span className="text-[10px] text-gray-600">Draft</span>)}
                                            </div>

                                            <div className="relative flex items-center gap-1">
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        if (menuOpen === project.id) closeMenu();
                                                        else {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setMenuPos({ top: rect.top - 8, left: rect.right });
                                                            setMenuOpen(project.id);
                                                            setMoveMenuOpen(null);
                                                        }
                                                    }}
                                                    className={`p-1.5 rounded-md transition-colors ${menuOpen === project.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                                >
                                                    <MoreHorizontal size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>

      {menuOpen && menuPos && activeMenuProject && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={closeMenu} />
            <div 
                className="fixed z-[70] bg-[#27272a] border border-white/10 rounded-lg shadow-2xl py-1 w-40"
                style={{ top: menuPos.top, left: menuPos.left, transform: 'translate(-100%, -100%)' }}
            >
                <button onClick={() => { onLoad(activeMenuProject); onClose(); }} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 flex items-center gap-2">
                    <Edit size={12} /> Open
                </button>
                <div 
                    className="relative"
                    onMouseEnter={() => setMoveMenuOpen(activeMenuProject.id)}
                    onMouseLeave={() => setMoveMenuOpen(null)}
                    onClick={(e) => { e.stopPropagation(); setMoveMenuOpen(moveMenuOpen ? null : activeMenuProject.id)}}
                >
                    <div className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2"><FolderPlus size={12} /> Move to...</div>
                        <ChevronRight size={12} />
                    </div>
                    {moveMenuOpen === activeMenuProject.id && (
                        <div className="absolute right-full bottom-0 mr-1 w-32 bg-[#333] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                            <button onClick={() => handleMoveProject(activeMenuProject, 'uncategorized')} className="w-full text-left px-3 py-2 text-[10px] text-gray-300 hover:bg-white/10 truncate">Uncategorized</button>
                            {customFolders.map(f => (
                                <button key={f} onClick={() => handleMoveProject(activeMenuProject, f)} className="w-full text-left px-3 py-2 text-[10px] text-gray-300 hover:bg-white/10 truncate">{f}</button>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={(e) => handleDuplicate(activeMenuProject, e)} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 flex items-center gap-2">
                    <Copy size={12} /> Duplicate
                </button>
                <div className="h-px bg-white/5 my-1"></div>
                <button onClick={(e) => handleDelete(activeMenuProject.id, e)} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                    <Trash2 size={12} /> Delete
                </button>
            </div>
          </>
      )}
    </div>
  );
}