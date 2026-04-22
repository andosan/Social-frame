import { ReactNode } from 'react';

export type Position = 
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type FormatType = 'square' | 'story';
export type LayoutType = 'standard' | 'image' | 'brand' | 'grid' | 'product' | 'list' | 'blog' | 'image-grid';
export type Language = 'en' | 'sl' | 'hr';

export interface FormatConfig {
  width: number;
  height: number;
  label: string;
  ratio: string;
}

export interface BackgroundConfig {
  image: string;
  brightness: number;
  alignment?: string;
}

export interface ProductOverlayConfig {
  visible: boolean;
  name: string;
  price: number | null;
  pricePrefix: string; // "Cena od"
  // Localized Price Prefixes
  pricePrefix_en?: string;
  pricePrefix_sl?: string;
  pricePrefix_hr?: string;
  
  position: 'bottom' | 'top';
  originalProduct?: Product;
}

export interface LinkConfig {
  url: string;
  // Localized URLs
  url_en?: string;
  url_sl?: string;
  url_hr?: string;
  
  type: 'product' | 'category' | 'custom' | 'homepage' | 'page' | 'blog';
  label: string;
  language: Language; // Keeps track of the link target language logic
}

export interface ListItem {
  id: string;
  title: string;
  description: string;
  
  // Localized Lists
  title_en?: string;
  title_sl?: string;
  title_hr?: string;
  
  description_en?: string;
  description_sl?: string;
  description_hr?: string;
}

export interface BlogPostRow {
  id: string;
  published_at: string;
  featured_image_url: string;
  // Multilingual fields
  title_en: string; title_sl?: string; title_hr?: string;
  excerpt_en: string; excerpt_sl?: string; excerpt_hr?: string;
  slug_en: string; slug_sl?: string; slug_hr?: string;
  status: string;
}

export interface ContentConfig {
  logo: {
    visible: boolean;
    size: number;
  };
  icon: string;
  bigNumber: {
    value: string;
    visible: boolean;
  };
  
  // -- Suffix-based Localization --
  heading: string; // Currently displayed value
  heading_en?: string;
  heading_sl?: string;
  heading_hr?: string;

  subtitle: string; // Currently displayed value
  subtitle_en?: string;
  subtitle_sl?: string;
  subtitle_hr?: string;

  cta: {
    text: string; // Currently displayed value
    text_en?: string;
    text_sl?: string;
    text_hr?: string;
    visible: boolean;
  };
  
  grid: {
    images: string[];
    gap: number;
  };
  listItems: ListItem[];
  productOverlay: ProductOverlayConfig;
  link: LinkConfig;
  originalBlogPost?: BlogPostRow; 
}

export interface ThemeConfig {
  primaryColor: string;
  textColor: string;
}

export interface BannerConfig {
  id: string;
  layout: LayoutType;
  format: FormatType;
  position: Position;
  background: BackgroundConfig;
  content: ContentConfig;
  theme: ThemeConfig;
}

export interface PositionStyle {
  justifyContent: string;
  alignItems: string;
  textAlign: 'left' | 'center' | 'right';
  gradient: string;
}

export interface Platform {
  id: string;
  name: string;
  icon: string | ReactNode; // Emoji or component
  color: string;
}

export interface Product {
  ItemCode: string;
  ItemName: string;      // EN (Default)
  ItemName_sl?: string;  // SI
  ItemName_hr?: string;  // HR
  LongDescription?: string;    // EN
  LongDescription_sl?: string; // SI
  LongDescription_hr?: string; // HR
  MainImage: string | null;
  AllImages: string | null;
  MainCategory: string;
  SubCategory: string;
  ItemPriceGross_Qty6?: number; // Added price field
}

export interface CalendarItem {
  date: string;
  topic: string;
  type: 'post' | 'story';
  visualPrompt: string;
  suggestedLayout: LayoutType;
  status: 'draft' | 'generated' | 'scheduled';
  captions?: {
    sl?: string;
    en?: string;
    hr?: string;
  };
  hashtags?: string[];
  designConfig?: BannerConfig;
}

export interface SavedProject {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  slides: BannerConfig[];
  scheduled_at?: string;
  status: 'draft' | 'scheduled';
  folder?: string;
}