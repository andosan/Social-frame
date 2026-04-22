import React from 'react';
import { FormatConfig, PositionStyle, Platform, BannerConfig } from './types';
import { 
  Instagram, Facebook, Linkedin, Twitter, Pin, 
  BookOpen, Heart, Star, Gift, Percent,
  Award, Zap, CheckCircle, TrendingUp, Users, Globe,
  Sun, Moon, Truck, Shield, Smile
} from 'lucide-react';

export const FORMATS: Record<string, FormatConfig> = {
  square: { width: 1080, height: 1080, label: 'Square', ratio: '1:1' },
  story: { width: 1080, height: 1350, label: 'Portrait / LinkedIn', ratio: '4:5' }
};

export const POSITIONS: string[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right'
];

export const POSITION_STYLES: Record<string, PositionStyle> = {
  'top-left': { justifyContent: 'flex-start', alignItems: 'flex-start', textAlign: 'left', gradient: 'linear-gradient(135deg, rgba(0,0,0,0.75) 0%, transparent 70%)' },
  'top-center': { justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center', gradient: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, transparent 60%)' },
  'top-right': { justifyContent: 'flex-start', alignItems: 'flex-end', textAlign: 'right', gradient: 'linear-gradient(225deg, rgba(0,0,0,0.75) 0%, transparent 70%)' },
  'center-left': { justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left', gradient: 'linear-gradient(90deg, rgba(0,0,0,0.75) 0%, transparent 60%)' },
  'center': { justifyContent: 'center', alignItems: 'center', textAlign: 'center', gradient: 'radial-gradient(circle, rgba(0,0,0,0.65) 0%, transparent 70%)' },
  'center-right': { justifyContent: 'center', alignItems: 'flex-end', textAlign: 'right', gradient: 'linear-gradient(270deg, rgba(0,0,0,0.75) 0%, transparent 60%)' },
  'bottom-left': { justifyContent: 'flex-end', alignItems: 'flex-start', textAlign: 'left', gradient: 'linear-gradient(45deg, rgba(0,0,0,0.75) 0%, transparent 70%)' },
  'bottom-center': { justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center', gradient: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, transparent 60%)' },
  'bottom-right': { justifyContent: 'flex-end', alignItems: 'flex-end', textAlign: 'right', gradient: 'linear-gradient(315deg, rgba(0,0,0,0.75) 0%, transparent 70%)' }
};

export const ICONS: Record<string, React.ReactNode> = {
  none: null,
  logo: <img src="https://auth.toastagift.com/storage/v1/object/public/blog-images/ToastAgift%20logo-02.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />,
  book: <BookOpen size="100%" />,
  heart: <Heart size="100%" />,
  star: <Star size="100%" />,
  gift: <Gift size="100%" />,
  percent: <Percent size="100%" />,
  award: <Award size="100%" />,
  zap: <Zap size="100%" />,
  check: <CheckCircle size="100%" />,
  trend: <TrendingUp size="100%" />,
  users: <Users size="100%" />,
  globe: <Globe size="100%" />,
  sun: <Sun size="100%" />,
  moon: <Moon size="100%" />,
  truck: <Truck size="100%" />,
  shield: <Shield size="100%" />,
  smile: <Smile size="100%" />
};

export const SAMPLE_IMAGES: string[] = [];

export const PLATFORMS: Platform[] = [
  { id: 'instagram', name: 'Instagram', icon: <Instagram />, color: '#E4405F' },
  { id: 'facebook', name: 'Facebook', icon: <Facebook />, color: '#1877F2' },
  { id: 'linkedin', name: 'LinkedIn', icon: <Linkedin />, color: '#0A66C2' },
  { id: 'twitter', name: 'X / Twitter', icon: <Twitter />, color: '#000000' },
  { id: 'pinterest', name: 'Pinterest', icon: <Pin />, color: '#E60023' }
];

export const SITE_PAGES = [
    { id: 'home', label: 'Domov / Home', en: '/', sl: '/sl', hr: '/hr' },
    { id: 'about', label: 'O nas / About', en: '/about', sl: '/sl/o-nas', hr: '/hr/o-nama' },
    { id: 'contact', label: 'Kontakt / Contact', en: '/contact', sl: '/sl/kontakt', hr: '/hr/kontakt' },
    { id: 'blog', label: 'Blog', en: '/blog', sl: '/sl/blog', hr: '/hr/blog' },
    { id: 'support', label: 'Podpora / Support', en: '/support', sl: '/sl/podpora', hr: '/hr/podrska' },
    { id: 'shipping', label: 'Dostava / Shipping', en: '/shipping', sl: '/sl/dostava', hr: '/hr/dostava' },
    { id: 'returns', label: 'Vračila / Returns', en: '/returns', sl: '/sl/vracila', hr: '/hr/povrat' },
    { id: 'faq', label: 'FAQ', en: '/faq', sl: '/sl/pogosta-vprasanja', hr: '/hr/cesta-pitanja' },
    { id: 'terms', label: 'Pogoji / Terms', en: '/terms', sl: '/sl/pogoji', hr: '/hr/uvjeti' },
    { id: 'privacy', label: 'Zasebnost / Privacy', en: '/privacy', sl: '/sl/zasebnost', hr: '/hr/privatnost' },
    { id: 'login', label: 'Prijava / Login', en: '/login', sl: '/sl/prijava', hr: '/hr/prijava' },
    { id: 'register', label: 'Registracija / Register', en: '/register', sl: '/sl/registracija', hr: '/hr/registracija' },
];

export const PRODUCT_CATEGORIES = [
    'Audio',
    'Bags & Travel',
    'Car & Safety',
    'Drinkware',
    'Eco',
    'Eating & Drinking',
    'First Aid',
    'Headwear',
    'Healthy Living & Sport',
    'Home & Living',
    'Kids & Games',
    'Lanyards & Keychains',
    'Office',
    'Outdoor',
    'Personal Care',
    'Phone & Tablet Accessories',
    'Portfolios & Notebooks',
    'Technology',
    'Textile',
    'Tools & Torches',
    'Umbrellas',
    'USB & Power',
    'Wellness',
    'Writing Instruments'
];

export const DEFAULT_CONFIG: BannerConfig = {
  id: 'default-1',
  layout: 'standard',
  format: 'square',
  position: 'bottom-left',
  background: { image: 'color:primary', brightness: 75, alignment: 'center' },
  content: {
    logo: { visible: true, size: 40 },
    icon: 'book',
    bigNumber: { value: '', visible: false },
    heading: 'Design Your Story',
    heading_en: 'Design Your Story', // Initialize to prevent data loss on switch
    subtitle: 'Create engaging content in seconds.',
    subtitle_en: 'Create engaging content in seconds.', // Initialize
    cta: { text: 'Read More', text_en: 'Read More', visible: true },
    grid: {
      images: ['color:#000000', 'color:#ffffff', 'color:primary'],
      gap: 3
    },
    listItems: [
        { id: '1', title: '', description: 'Integrated 15W wireless charging' },
        { id: '2', title: '', description: 'RFID protection pockets' },
        { id: '3', title: '', description: 'Italian Saffiano leather exterior' }
    ],
    productOverlay: {
      visible: false,
      name: '',
      price: null,
      pricePrefix: 'Cena od',
      pricePrefix_en: 'Price from',
      pricePrefix_sl: 'Cena od',
      pricePrefix_hr: 'Cijena od',
      position: 'bottom'
    },
    link: {
      url: '',
      url_en: '', // Initialize
      type: 'homepage',
      label: 'Visit Site',
      language: 'en'
    }
  },
  theme: { primaryColor: '#e71e86', textColor: '#ffffff' }
};