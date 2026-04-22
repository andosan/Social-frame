import React, { forwardRef } from 'react';
import { BannerConfig } from '../types';
import { FORMATS, POSITION_STYLES, ICONS, SITE_PAGES } from '../constants';

interface BannerPreviewProps {
  config: BannerConfig;
  isExport?: boolean;
}

// Helper to encode URLs with + for spaces
const encode = (str: string) => {
  return encodeURIComponent(str).replace(/%20/g, '+');
};

// Brand Layout Logo (Combined Icon + Text)
const BrandLogo = () => (
  <img 
    src="https://auth.toastagift.com/storage/v1/object/public/blog-images/ToastAgift%20logo-03.png" 
    alt="Toast a Gift"
    style={{ 
        height: '124px', 
        width: 'auto',
        objectFit: 'contain',
        maxWidth: 'none'
    }}
  />
);

// Standard Icon (Square Symbol Only)
const StandardIcon = () => (
  <img 
    src="https://auth.toastagift.com/storage/v1/object/public/blog-images/ToastAgift%20logo-02.png" 
    alt="Logo"
    style={{ 
        width: '100%', 
        height: '100%', 
        objectFit: 'contain'
    }}
  />
);

const BannerPreview = forwardRef<HTMLDivElement, BannerPreviewProps>(({ config, isExport }, ref) => {
  const format = FORMATS[config.format];
  const { primaryColor, textColor } = config.theme;
  const isBrandLayout = config.layout === 'brand';
  const isImageLayout = config.layout === 'image';
  const isProductLayout = config.layout === 'product';
  const isListLayout = config.layout === 'list';
  const isBlogLayout = config.layout === 'blog';
  const isImageGridLayout = config.layout === 'image-grid';
  const isStandardLayout = config.layout === 'standard' || config.layout === 'blog'; // Blog uses standard visual layout
  
  // Use config position unless it's brand layout, which forces center
  const posStyle = isBrandLayout 
    ? { ...POSITION_STYLES['center'], gradient: 'radial-gradient(circle, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 100%)' } 
    : POSITION_STYLES[config.position];
    
  // If no images (pure color background), remove gradient to keep it clean.
  // Otherwise apply the selected position gradient.
  const gradient = config.content.grid.images.length === 0 ? 'none' : posStyle.gradient;

  // Helper to resolve background style (Color vs Image)
  const resolveBackground = (src: string | undefined, primaryColor: string, alignment: string = 'center') => {
    if (!src) return { backgroundColor: '#000' }; // Fallback
    
    if (src.startsWith('color:')) {
        const color = src === 'color:primary' ? primaryColor : src.replace('color:', '');
        return { backgroundColor: color };
    }
    return { 
        backgroundImage: `url(${src})`,
        backgroundSize: 'cover',
        backgroundPosition: alignment.replace('-', ' ')
    };
  };

  const renderIcon = () => {
    if (isImageLayout) return null;

    if (isProductLayout && config.content.productOverlay?.price) {
        return (
            <div className="mb-6 flex flex-col" style={{ alignItems: posStyle.alignItems }}>
                <span style={{ 
                    fontSize: '16px', 
                    fontWeight: 600, 
                    color: 'rgba(255,255,255,0.7)', 
                    marginBottom: '4px', 
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    {config.content.productOverlay.pricePrefix}
                </span>
                <span style={{ 
                    fontSize: '64px', 
                    fontWeight: 800, 
                    color: primaryColor,
                    lineHeight: 0.9,
                    letterSpacing: '-2px'
                }}>
                    €{config.content.productOverlay.price.toFixed(2)}
                </span>
            </div>
        );
    }

    if (config.content.icon === 'none') return null;
    
    if (config.content.icon === 'logo') {
        return <div className="w-24 h-24 mb-6"><StandardIcon /></div>;
    }

    const IconComponent = ICONS[config.content.icon];
    return IconComponent ? <div className="w-24 h-24 mb-6" style={{ color: textColor }}>{IconComponent}</div> : null;
  };

  // Improved Font Size Calculator
  const calculateFontSize = (text: string, isStory: boolean, isBlog: boolean) => {
    let size = isStory ? 72 : 80;
    if (!text) return `${size}px`;
    
    const len = text.length;
    
    if (len < 12) size = isStory ? 72 : 80;
    else if (len < 20) size = isStory ? 60 : 64;
    else if (len < 35) size = isStory ? 48 : 52;
    else if (len < 60) size = isStory ? 36 : 40;
    else size = isStory ? 28 : 32;

    // Blog titles (Mixed Case) need to be visually larger to match the weight of Uppercase
    if (isBlog) size = size * 1.25;

    return `${Math.round(size)}px`;
  };

  const headingSize = calculateFontSize(config.content.heading, config.format === 'story', isBlogLayout);

  const getGridStyle = () => {
    const count = config.content.grid.images.length;
    const isSquare = config.format === 'square';
    
    let gridTemplate = { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };

    if (count <= 1) {
       gridTemplate = { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    } else if (count === 2) {
       gridTemplate = isSquare 
          ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' } 
          : { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' };
    } else if (count === 3) {
       gridTemplate = isSquare 
          ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' } 
          : { gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(3, 1fr)' };
    } else if (count === 4) {
       gridTemplate = { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    } else {
       gridTemplate = { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
    }

    return {
      display: 'grid',
      width: '100%',
      height: '100%',
      gap: `${config.content.grid.gap}px`,
      padding: `${config.content.grid.gap}px`, 
      ...gridTemplate
    };
  };

  const getTargetUrl = () => {
     const { type, url, language = 'en' } = config.content.link || { type: 'homepage', url: '', language: 'en' };
     const baseUrl = "https://toastagift.com/#";
     const prefix = language === 'en' ? '' : `/${language}`;
     
     if (type === 'homepage') {
         const homePath = language === 'en' ? '/' : prefix;
         return `${baseUrl}${homePath}`;
     }
     
     if (type === 'product') {
         let path = 'product';
         if (language === 'sl') path = 'izdelek';
         if (language === 'hr') path = 'proizvod';
         return `${baseUrl}${prefix}/${path}/${url || ''}`;
     }
     
     if (type === 'category') {
         // Fix: Ensure correct path structure for hash routing
         // EN: /#/ + ?category=...
         // SL: /#/sl + ?category=...
         const catPath = language === 'en' ? '/' : prefix;
         
         const parts = (url || '').split('&subcategory=');
         const main = parts[0];
         const sub = parts[1];
         
         let link = `${baseUrl}${catPath}?category=${encode(main)}`;
         if (sub) {
             link += `&subcategory=${encode(sub)}`;
         }
         return link;
     }
     
     if (type === 'page') {
         const pageObj = SITE_PAGES.find(p => p.id === url);
         if (pageObj) {
             const localizedPath = pageObj[language as keyof typeof pageObj];
             return `${baseUrl}${localizedPath}`;
         }
         const safeUrl = url.startsWith('/') ? url : `/${url}`;
         return `${baseUrl}${prefix}${safeUrl}`;
     }
     
     if (type === 'blog') {
         // Blog logic: /blog/{slug_en} (EN) or /sl/blog/{slug_en} (SL)
         let blogPath = '/blog/';
         if (language === 'sl') blogPath = '/sl/blog/';
         if (language === 'hr') blogPath = '/hr/blog/';
         
         return `${baseUrl}${blogPath}${url}`;
     }
     
     if (url.startsWith('http')) return url;
     return `${baseUrl}${prefix}/${url}`;
  };

  // Logic Update: Always render grid if images exist. 
  // If no grid images, fallback to background.image for backward compatibility, or just a solid color.
  const gridImages = config.content.grid.images;
  const shouldRenderGrid = gridImages.length > 0;
  
  // Only render legacy background if no grid images.
  const shouldRenderLegacyBackground = !shouldRenderGrid && config.background.image;

  // Resolve legacy background style
  const bgStyle = shouldRenderLegacyBackground
      ? resolveBackground(config.background.image, primaryColor, config.background.alignment) 
      : {};

  return (
    <a 
      href={getTargetUrl()}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'block', textDecoration: 'none', cursor: 'pointer' }}
      title={`Open: ${getTargetUrl()}`}
    >
        <div
          ref={ref}
          style={{
            width: format.width,
            height: format.height,
            backgroundColor: '#000',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: "'Manrope', sans-serif"
          }}
        >
          {/* Legacy Background (Fallback) */}
          {shouldRenderLegacyBackground && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                filter: `brightness(${config.background.brightness}%)`,
                ...bgStyle
              }}
            />
          )}

          {/* Universal Grid Layout */}
          {shouldRenderGrid && (
            <div style={getGridStyle()}>
              {gridImages.map((img, idx) => {
                const isThreeSquare = gridImages.length === 3 && config.format === 'square';
                
                // Resolve grid item style
                const itemStyle = resolveBackground(img, primaryColor);
                // Apply global brightness setting to grid items
                const filter = `brightness(${config.background.brightness}%)`;
                
                const style: React.CSSProperties = {
                   width: '100%', 
                   height: '100%', 
                   borderRadius: '4px',
                   filter,
                   ...itemStyle
                };
                
                if (isThreeSquare && idx === 0) {
                   return (
                      <div key={idx} style={{ gridRow: 'span 2', position: 'relative' }}>
                         <div style={style} />
                      </div>
                   );
                }

                return (
                  <div key={idx} style={{ position: 'relative', overflow: 'hidden' }}>
                    <div style={style} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Gradient Overlay - Shows on all layouts except 'Image' (legacy) or if explicit */}
          {(!isImageLayout) && (
            <div 
              style={{ 
                position: 'absolute', 
                inset: 0, 
                background: gradient
              }} 
            />
          )}

          {/* Brand Layout Logo Layer */}
          {isBrandLayout && config.content.logo.visible && (
             <div
                style={{
                   position: 'absolute',
                   top: '50%',
                   left: '50%',
                   transform: `translate(-50%, -50%) scale(${config.content.logo.size / 40})`,
                   zIndex: 20,
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   transformOrigin: 'center center'
                }}
             >
                <BrandLogo />
             </div>
          )}
          
          {/* Brand Layout Website Link */}
          {isBrandLayout && (
             <div
                style={{
                   position: 'absolute',
                   bottom: '10%',
                   left: '50%',
                   transform: 'translateX(-50%)',
                   fontSize: '28px',
                   fontWeight: 600,
                   color: textColor,
                   zIndex: 20,
                   letterSpacing: '0.1em',
                   opacity: 0.9
                }}
             >
                www.toastagift.com
             </div>
          )}

          {/* Standard / List Content Container - Excludes 'image-grid' */}
          {(isStandardLayout || isListLayout || isProductLayout) && !isImageGridLayout && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: config.format === 'story' ? '120px 80px' : '100px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: posStyle.justifyContent,
                alignItems: posStyle.alignItems,
                textAlign: posStyle.textAlign,
                color: textColor,
                gap: '24px',
                zIndex: 10,
                pointerEvents: 'none' 
              }}
            >
              {renderIcon()}

              {config.content.bigNumber.visible && config.content.bigNumber.value && (
                <div 
                  style={{ 
                    fontSize: '160px', 
                    fontWeight: 800, 
                    lineHeight: 0.9,
                    marginBottom: '10px',
                    letterSpacing: '-0.04em'
                  }}
                >
                  {config.content.bigNumber.value}
                </div>
              )}

              {(config.content.heading || config.content.subtitle) && (
                <div style={{ 
                  pointerEvents: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  alignItems: posStyle.alignItems
                }}>
                  <h1
                    style={{
                      fontSize: headingSize, 
                      fontWeight: 800,
                      lineHeight: isBlogLayout ? 1.15 : 1.1,
                      margin: 0,
                      textTransform: isBlogLayout ? 'none' : 'uppercase',
                      borderTop: (isStandardLayout) ? `8px solid ${primaryColor}` : 'none',
                      paddingTop: (isStandardLayout) ? '32px' : '0',
                      maxWidth: '100%',
                      textShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      transition: 'font-size 0.2s ease-out'
                    }}
                  >
                    {config.content.heading}
                  </h1>
                  <h2
                    style={{
                      fontSize: config.format === 'story' ? '32px' : '40px',
                      fontWeight: 400,
                      marginTop: '16px',
                      opacity: 0.9,
                      maxWidth: '100%',
                      textShadow: '0 5px 20px rgba(0,0,0,0.5)'
                    }}
                  >
                    {config.content.subtitle}
                  </h2>
                </div>
              )}

              {/* List Items Rendering */}
              {isListLayout && config.content.listItems && (
                  <div style={{ width: '100%', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px', alignItems: posStyle.alignItems }}>
                      {config.content.listItems.map(item => {
                          const hasTitle = !!item.title;
                          
                          return (
                              <div key={item.id} style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: posStyle.alignItems, maxWidth: '100%' }}>
                                  {hasTitle ? (
                                      <>
                                        <div style={{ fontSize: '32px', fontWeight: 800, color: primaryColor, textTransform: 'uppercase', lineHeight: 1.2 }}>
                                            {item.title}
                                        </div>
                                        <div style={{ fontSize: '24px', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
                                            {item.description}
                                        </div>
                                      </>
                                  ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                          <span style={{ color: primaryColor, fontSize: '28px', fontWeight: 'bold' }}>→</span>
                                          <div style={{ fontSize: '28px', fontWeight: 600, color: '#fff', textAlign: 'left' }}>
                                            {item.description}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          )
                      })}
                  </div>
              )}

              {/* Render CTA only if text exists to prevent distorted pill */}
              {config.content.cta.visible && config.content.cta.text && config.content.cta.text.trim() !== '' && (
                <div style={{ marginTop: '40px', pointerEvents: 'auto' }}>
                  <div
                    style={{
                      backgroundColor: primaryColor,
                      padding: isExport ? '10px 48px 38px 48px' : '24px 48px', // Aggressive padding shift for export
                      borderRadius: '100px',
                      // HTML2Canvas often glitches with heavy box-shadows on rounded elements in export.
                      // We remove it during export to ensure a clean render without gradient artifacts in corners.
                      boxShadow: isExport ? 'none' : '0 20px 50px rgba(0,0,0,0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '220px',
                      position: 'relative' // Create stacking context
                    }}
                  >
                    <span
                        style={{
                            color: '#fff', 
                            fontSize: '24px',
                            fontWeight: 700,
                            lineHeight: '1.2',
                            whiteSpace: 'nowrap',
                            position: 'relative', // Ensure text is rendered above potential background artifacts
                            zIndex: 10
                        }}
                    >
                        {config.content.cta.text}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
    </a>
  );
});

BannerPreview.displayName = 'BannerPreview';

export default BannerPreview;