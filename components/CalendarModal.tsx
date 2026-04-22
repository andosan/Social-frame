import React, { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { SavedProject } from '../types';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  projects: SavedProject[];
  projectToSchedule: SavedProject | null;
}

export default function CalendarModal({ isOpen, onClose, onSelectDate, projects, projectToSchedule }: CalendarModalProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState("09:00");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Helper to get days in month
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  
  // Helper to get day of week for first day (0 = Mon, 6 = Sun) for European style
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  // Generate calendar grid
  const days = useMemo(() => {
    const result = [];
    // Padding for empty start days
    for (let i = 0; i < firstDay; i++) {
      result.push(null);
    }
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      result.push(i);
    }
    return result;
  }, [year, month, firstDay, daysInMonth]);

  // Map scheduled projects to dates
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

  const handleDayClick = (day: number) => {
    // Construct ISO string with selected time
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateTimeStr = `${dateStr}T${selectedTime}:00`;
    const isoDate = new Date(dateTimeStr).toISOString();
    onSelectDate(isoDate);
  };

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(year, month + delta, 1));
  };

  if (!isOpen) return null;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-[#18181b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 h-[80vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#18181b] z-10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CalendarIcon className="text-primary" size={24} /> 
              Schedule Project
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Selecting date for: <span className="text-white font-medium">{projectToSchedule?.name}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Time Picker */}
             <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
                <Clock size={14} className="text-gray-400" />
                <input 
                    type="time" 
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="bg-transparent text-white text-sm focus:outline-none w-20"
                />
             </div>

             <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors">
                <X size={20} />
             </button>
          </div>
        </div>

        {/* Calendar Controls */}
        <div className="flex items-center justify-between px-8 py-4 bg-[#131315] border-b border-white/5">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/5 rounded-full text-white transition-colors">
                <ChevronLeft size={24} />
            </button>
            <h3 className="text-xl font-bold text-white uppercase tracking-widest">
                {monthNames[month]} {year}
            </h3>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/5 rounded-full text-white transition-colors">
                <ChevronRight size={24} />
            </button>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#131315]">
            <div className="grid grid-cols-7 mb-2">
                {weekDays.map(d => (
                    <div key={d} className="text-center text-xs font-bold text-gray-500 uppercase py-2">
                        {d}
                    </div>
                ))}
            </div>
            
            <div className="grid grid-cols-7 grid-rows-5 gap-2 h-full min-h-[400px]">
                {days.map((day, idx) => {
                    if (day === null) {
                        return <div key={`empty-${idx}`} className="bg-transparent" />;
                    }

                    const existing = scheduledMap[day] || [];
                    const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                    const isSelected = projectToSchedule?.scheduled_at && new Date(projectToSchedule.scheduled_at).getDate() === day && new Date(projectToSchedule.scheduled_at).getMonth() === month;

                    return (
                        <button 
                            key={day}
                            onClick={() => handleDayClick(day)}
                            className={`
                                relative rounded-xl border flex flex-col items-start justify-start p-2 transition-all group overflow-hidden
                                ${isSelected ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20'}
                                ${isToday ? 'ring-1 ring-white/50' : ''}
                            `}
                        >
                            <span className={`text-sm font-bold mb-2 ${isToday ? 'text-white' : 'text-gray-400'}`}>{day}</span>
                            
                            <div className="flex flex-col gap-1 w-full overflow-y-auto max-h-[80px] scrollbar-hide">
                                {existing.map(p => (
                                    <div 
                                        key={p.id}
                                        className={`text-[10px] px-1.5 py-1 rounded truncate w-full text-left
                                            ${p.id === projectToSchedule?.id ? 'bg-primary text-white' : 'bg-white/10 text-gray-300'}
                                        `}
                                        title={p.name}
                                    >
                                        {p.name}
                                    </div>
                                ))}
                            </div>
                            
                            {/* Hover effect to show add action */}
                            <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                <span className="font-bold text-white text-xs bg-black/50 px-2 py-1 rounded">Schedule Here</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
}