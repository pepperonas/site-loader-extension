// Funktion zum Konvertieren von Ressourcen zu Base64
async function resourceToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Fehler beim Laden der Ressource:', url, error);
    return null;
  }
}

// Funktion zum Einbetten von Bildern
async function embedImages(doc) {
  const images = doc.querySelectorAll('img[src]');
  for (const img of images) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;
    
    try {
      const absoluteUrl = new URL(src, window.location.href).href;
      const base64 = await resourceToBase64(absoluteUrl);
      if (base64) {
        img.setAttribute('src', base64);
      }
    } catch (error) {
      console.warn('Fehler bei Bild:', src, error);
    }
  }
}

// Funktion zum Einbetten von CSS
async function embedStyles(doc) {
  const links = doc.querySelectorAll('link[rel="stylesheet"]');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href) continue;
    
    try {
      const absoluteUrl = new URL(href, window.location.href).href;
      const response = await fetch(absoluteUrl);
      let cssText = await response.text();
      
      // CSS url() Referenzen konvertieren
      const urlPattern = /url\(['"]?([^'")\s]+)['"]?\)/g;
      const matches = [...cssText.matchAll(urlPattern)];
      
      for (const match of matches) {
        const resourceUrl = match[1];
        if (resourceUrl.startsWith('data:')) continue;
        
        try {
          const absoluteResourceUrl = new URL(resourceUrl, absoluteUrl).href;
          const base64 = await resourceToBase64(absoluteResourceUrl);
          if (base64) {
            cssText = cssText.replace(match[0], `url(${base64})`);
          }
        } catch (error) {
          console.warn('Fehler bei CSS-Ressource:', resourceUrl, error);
        }
      }
      
      // Ersetze link durch style
      const style = doc.createElement('style');
      style.textContent = cssText;
      link.parentNode.replaceChild(style, link);
    } catch (error) {
      console.warn('Fehler bei CSS:', href, error);
    }
  }
  
  // Inline Styles mit url() behandeln
  const inlineStyles = doc.querySelectorAll('style');
  for (const style of inlineStyles) {
    let cssText = style.textContent;
    const urlPattern = /url\(['"]?([^'")\s]+)['"]?\)/g;
    const matches = [...cssText.matchAll(urlPattern)];
    
    for (const match of matches) {
      const resourceUrl = match[1];
      if (resourceUrl.startsWith('data:')) continue;
      
      try {
        const absoluteResourceUrl = new URL(resourceUrl, window.location.href).href;
        const base64 = await resourceToBase64(absoluteResourceUrl);
        if (base64) {
          cssText = cssText.replace(match[0], `url(${base64})`);
        }
      } catch (error) {
        console.warn('Fehler bei inline CSS-Ressource:', resourceUrl, error);
      }
    }
    
    style.textContent = cssText;
  }
}

// Funktion zum Einbetten von Background Images
async function embedBackgroundImages(doc) {
  const elements = doc.querySelectorAll('[style*="background"]');
  for (const element of elements) {
    const style = element.getAttribute('style');
    if (!style) continue;

    const urlPattern = /url\(['"]?([^'")\s]+)['"]?\)/g;
    let newStyle = style;
    const matches = [...style.matchAll(urlPattern)];

    for (const match of matches) {
      const url = match[1];
      if (url.startsWith('data:')) continue;

      try {
        const absoluteUrl = new URL(url, window.location.href).href;
        const base64 = await resourceToBase64(absoluteUrl);
        if (base64) {
          newStyle = newStyle.replace(match[0], `url(${base64})`);
        }
      } catch (error) {
        console.warn('Fehler bei Background-Image:', url, error);
      }
    }

    element.setAttribute('style', newStyle);
  }
}

// Funktion zum Einbetten von JavaScript-Dateien
async function embedScripts(doc) {
  const scripts = doc.querySelectorAll('script[src]');
  for (const script of scripts) {
    const src = script.getAttribute('src');
    if (!src) continue;

    try {
      const absoluteUrl = new URL(src, window.location.href).href;
      const response = await fetch(absoluteUrl);
      const jsText = await response.text();

      // Erstelle neues inline Script
      const inlineScript = doc.createElement('script');

      // Kopiere alle Attribute außer src
      for (const attr of script.attributes) {
        if (attr.name !== 'src') {
          inlineScript.setAttribute(attr.name, attr.value);
        }
      }

      inlineScript.textContent = jsText;
      script.parentNode.replaceChild(inlineScript, script);
    } catch (error) {
      console.warn('Fehler bei JavaScript:', src, error);
    }
  }
}

// Funktion zum Einbetten von Favicons
async function embedFavicons(doc) {
  const favicons = doc.querySelectorAll('link[rel*="icon"]');
  for (const favicon of favicons) {
    const href = favicon.getAttribute('href');
    if (!href || href.startsWith('data:')) continue;

    try {
      const absoluteUrl = new URL(href, window.location.href).href;
      const base64 = await resourceToBase64(absoluteUrl);
      if (base64) {
        favicon.setAttribute('href', base64);
      }
    } catch (error) {
      console.warn('Fehler bei Favicon:', href, error);
    }
  }
}

// Funktion zum Einbetten von SVG-Dateien
async function embedSVGs(doc) {
  // SVG in <img> Tags
  const svgImages = doc.querySelectorAll('img[src$=".svg"], img[src*=".svg?"]');
  for (const img of svgImages) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;

    try {
      const absoluteUrl = new URL(src, window.location.href).href;
      const base64 = await resourceToBase64(absoluteUrl);
      if (base64) {
        img.setAttribute('src', base64);
      }
    } catch (error) {
      console.warn('Fehler bei SVG-Bild:', src, error);
    }
  }

  // SVG in <object> Tags
  const svgObjects = doc.querySelectorAll('object[data$=".svg"], object[data*=".svg?"]');
  for (const obj of svgObjects) {
    const data = obj.getAttribute('data');
    if (!data || data.startsWith('data:')) continue;

    try {
      const absoluteUrl = new URL(data, window.location.href).href;
      const base64 = await resourceToBase64(absoluteUrl);
      if (base64) {
        obj.setAttribute('data', base64);
      }
    } catch (error) {
      console.warn('Fehler bei SVG-Object:', data, error);
    }
  }
}

// Hauptfunktion
async function downloadPageAsHTML() {
  try {
    // Klone das Dokument
    const clone = document.documentElement.cloneNode(true);
    const doc = document.implementation.createHTMLDocument();
    doc.documentElement.replaceWith(clone);

    // Verarbeite alle Ressourcen
    await embedStyles(doc);
    await embedImages(doc);
    await embedSVGs(doc);
    await embedBackgroundImages(doc);
    await embedFavicons(doc);
    await embedScripts(doc);
    
    // Füge Meta-Tag für Encoding hinzu
    const metaCharset = doc.querySelector('meta[charset]');
    if (!metaCharset) {
      const meta = doc.createElement('meta');
      meta.setAttribute('charset', 'UTF-8');
      doc.head.insertBefore(meta, doc.head.firstChild);
    }
    
    // Generiere HTML String
    const htmlContent = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    
    // Erstelle Blob
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Generiere Dateinamen
    const pageTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'website';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${pageTitle}_${timestamp}.html`;
    
    // Download starten
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Aufräumen
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    
    return { success: true };
  } catch (error) {
    console.error('Fehler beim Download:', error);
    return { success: false, error: error.message };
  }
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadPage') {
    downloadPageAsHTML().then(sendResponse);
    return true; // Async response
  }
});
