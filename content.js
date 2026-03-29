/**
 * Content Script — Site Loader Extension v2.0
 *
 * Robust website download with:
 * - CORS-free fetching via background service worker
 * - Parallel resource loading with concurrency pool
 * - URL deduplication / caching
 * - All resource types: CSS (@import, url()), images (src, srcset, picture),
 *   SVGs, background images, favicons, fonts, video posters, scripts
 * - ZIP mode (HTML + assets/) or single-file HTML (base64)
 * - Progress reporting to popup
 */

(() => {
  // Guard against double-injection — but allow re-injection after extension update
  // by checking if the runtime context is still valid
  if (window.__siteLoaderActive) {
    try {
      chrome.runtime.getURL('');
      // Context still valid, skip re-injection
      return;
    } catch (e) {
      // Context invalidated (extension updated), allow re-injection
      window.__siteLoaderActive = false;
    }
  }
  window.__siteLoaderActive = true;

  // ─── Helpers ───────────────────────────────────────────────

  var resourceCache = new Map(); // url -> { base64, contentType, blob }
  var totalResources = 0;
  var loadedResources = 0;
  var failedResources = 0;

  function reportProgress(stage, detail) {
    try {
      chrome.runtime.sendMessage({
        action: 'progress',
        stage,
        detail,
        total: totalResources,
        loaded: loadedResources,
        failed: failedResources
      });
    } catch (e) {
      // Extension context may be invalidated
    }
  }

  /**
   * Fetch resource via background service worker (CORS-free)
   */
  async function bgFetch(url, responseType) {
    responseType = responseType || 'base64';
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) {
      return null;
    }

    // Normalize URL
    try {
      url = new URL(url, window.location.href).href;
    } catch (e) {
      return null;
    }

    // Check cache
    var cacheKey = responseType + ':' + url;
    if (resourceCache.has(cacheKey)) {
      return resourceCache.get(cacheKey);
    }

    try {
      var result = await chrome.runtime.sendMessage({
        action: 'fetchResource',
        url: url,
        responseType: responseType
      });

      if (result && result.success) {
        resourceCache.set(cacheKey, result);
        loadedResources++;
        return result;
      } else {
        failedResources++;
        console.warn('[SiteLoader] Failed: ' + url, result ? result.error : 'unknown');
        return null;
      }
    } catch (error) {
      failedResources++;
      console.warn('[SiteLoader] Fetch error: ' + url, error.message);
      return null;
    }
  }

  /**
   * Batch-fetch URLs via background with concurrency
   */
  async function bgFetchBatch(urls, responseType) {
    responseType = responseType || 'base64';
    // Filter and deduplicate
    var seen = new Set();
    var uniqueUrls = [];
    for (var i = 0; i < urls.length; i++) {
      var u = urls[i];
      if (!u || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('javascript:')) continue;
      if (!seen.has(u)) {
        seen.add(u);
        uniqueUrls.push(u);
      }
    }

    // Resolve to absolute
    var absoluteUrls = [];
    for (var j = 0; j < uniqueUrls.length; j++) {
      try {
        absoluteUrls.push(new URL(uniqueUrls[j], window.location.href).href);
      } catch (e) { /* skip invalid */ }
    }

    // Filter already cached
    var uncached = absoluteUrls.filter(function(u) {
      return !resourceCache.has(responseType + ':' + u);
    });

    // Fetch in chunks to avoid exceeding Chrome's IPC message size limit (~64MB)
    // Keep chunks small — response data (base64) can be large per resource
    var CHUNK_SIZE = 10;
    for (var chunkStart = 0; chunkStart < uncached.length; chunkStart += CHUNK_SIZE) {
      var chunk = uncached.slice(chunkStart, chunkStart + CHUNK_SIZE);
      try {
        var results = await chrome.runtime.sendMessage({
          action: 'fetchBatch',
          urls: chunk,
          responseType: responseType
        });

        if (results) {
          var keys = Object.keys(results);
          for (var k = 0; k < keys.length; k++) {
            var batchUrl = keys[k];
            var batchResult = results[batchUrl];
            var ck = responseType + ':' + batchUrl;
            if (batchResult.success) {
              resourceCache.set(ck, batchResult);
              loadedResources++;
            } else {
              failedResources++;
            }
          }
        }
        reportProgress('fetching', (chunkStart + chunk.length) + ' / ' + uncached.length + ' Ressourcen');
      } catch (error) {
        console.warn('[SiteLoader] Batch fetch error:', error.message);
        failedResources += chunk.length;
      }
    }

    // Return map of url -> result
    var resultMap = {};
    for (var m = 0; m < absoluteUrls.length; m++) {
      var aUrl = absoluteUrls[m];
      var cKey = responseType + ':' + aUrl;
      resultMap[aUrl] = resourceCache.get(cKey) || null;
    }
    return resultMap;
  }

  function toAbsolute(url, base) {
    try {
      return new URL(url, base || window.location.href).href;
    } catch (e) {
      return null;
    }
  }

  /**
   * Generate a stable filename from a URL for ZIP assets
   */
  function urlToFilename(url) {
    try {
      var parsed = new URL(url);
      var path = parsed.pathname.replace(/^\//, '') || 'index';
      // Remove query string for filename but keep hash for uniqueness
      var hash = parsed.search ? '_' + simpleHash(parsed.search) : '';
      // Sanitize
      path = path.replace(/[^a-zA-Z0-9._\-\/]/g, '_');
      // Limit length
      if (path.length > 100) {
        path = path.substring(0, 80) + '_' + simpleHash(path);
      }
      return path + hash;
    } catch (e) {
      return 'resource_' + simpleHash(url);
    }
  }

  /**
   * Get a unique asset path, avoiding collisions with existing zipAssets entries
   */
  // Track used asset paths to detect collisions (faster than scanning zipAssets)
  var usedAssetPaths = new Map(); // path -> url

  function uniqueAssetPath(basePath, url) {
    var existingUrl = usedAssetPaths.get(basePath);
    if (!existingUrl || existingUrl === url) {
      usedAssetPaths.set(basePath, url);
      return basePath;
    }
    // Collision: different URL mapped to same path — append hash
    var candidate;
    var dotIdx = basePath.lastIndexOf('.');
    if (dotIdx > 0) {
      candidate = basePath.substring(0, dotIdx) + '_' + simpleHash(url) + basePath.substring(dotIdx);
    } else {
      candidate = basePath + '_' + simpleHash(url);
    }
    usedAssetPaths.set(candidate, url);
    return candidate;
  }

  function simpleHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get or register a ZIP asset path for a URL.
   * If the URL already has a registered path, return that path (dedup).
   * Otherwise, register the new asset and return the new path.
   */
  function registerZipAsset(zipAssets, absUrl, preferredDir, res) {
    // Dedup: if already registered, reuse existing path
    if (zipAssets.has(absUrl)) {
      return zipAssets.get(absUrl).path;
    }
    var ext = getMimeExtension(res.contentType) || '';
    var fn = urlToFilename(absUrl);
    var basePath = preferredDir + fn + (fn.includes('.') ? '' : ext);
    var assetPath = uniqueAssetPath(basePath, absUrl);
    if (res.text !== undefined) {
      zipAssets.set(absUrl, { path: assetPath, text: res.text || res.data, contentType: res.contentType });
    } else {
      zipAssets.set(absUrl, { path: assetPath, base64: res.data, contentType: res.contentType });
    }
    return assetPath;
  }

  function getMimeExtension(contentType) {
    if (!contentType) return '';
    var mime = contentType.split(';')[0].trim();
    var map = {
      'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
      'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/x-icon': '.ico',
      'image/avif': '.avif', 'image/bmp': '.bmp',
      'font/woff': '.woff', 'font/woff2': '.woff2',
      'application/font-woff': '.woff', 'application/font-woff2': '.woff2',
      'font/ttf': '.ttf', 'font/otf': '.otf',
      'application/x-font-ttf': '.ttf', 'application/x-font-otf': '.otf',
      'text/css': '.css', 'text/javascript': '.js', 'application/javascript': '.js',
      'application/json': '.json'
    };
    return map[mime] || '';
  }

  // ─── CSS Processing ────────────────────────────────────────

  /**
   * Recursively resolve @import and url() in CSS text
   */
  async function processCSS(cssText, baseUrl, mode, zipAssets, visited, depth) {
    if (!cssText) return cssText;
    visited = visited || new Set();
    depth = depth || 0;
    if (depth > 10) return cssText; // Max recursion depth for @import chains

    // 1. Resolve @import statements
    var importPattern = /@import\s+(?:url\(\s*['"]?([^'")\s]+)['"]?\s*\)|['"]([^'"]+)['"])\s*([^;]*);/g;
    var match;
    var imports = [];
    while ((match = importPattern.exec(cssText)) !== null) {
      imports.push({
        full: match[0],
        url: match[1] || match[2],
        media: (match[3] || '').trim()
      });
    }

    for (var i = 0; i < imports.length; i++) {
      var imp = imports[i];
      var importUrl = toAbsolute(imp.url, baseUrl);
      if (!importUrl) continue;

      // Prevent circular @import
      if (visited.has(importUrl)) continue;
      visited.add(importUrl);

      var result = await bgFetch(importUrl, 'text');
      if (result) {
        var importedCSS = result.data;
        // Recursively process the imported CSS
        importedCSS = await processCSS(importedCSS, importUrl, mode, zipAssets, visited, depth + 1);
        if (imp.media) {
          importedCSS = '@media ' + imp.media + ' { ' + importedCSS + ' }';
        }
        cssText = cssText.replace(imp.full, importedCSS);
      }
    }

    // 2. Resolve url() references (fonts, images, etc.)
    var urlPattern = /url\(\s*(['"]?)(?!data:|blob:|javascript:)([^'")\s]+)\1\s*\)/g;
    var urlMatches = [];
    while ((match = urlPattern.exec(cssText)) !== null) {
      urlMatches.push({ full: match[0], quote: match[1], url: match[2] });
    }

    if (urlMatches.length === 0) return cssText;

    // Batch fetch all CSS resource URLs
    var urls = [];
    for (var j = 0; j < urlMatches.length; j++) {
      var absUrl = toAbsolute(urlMatches[j].url, baseUrl);
      if (absUrl) urls.push(absUrl);
    }
    totalResources += urls.length;
    reportProgress('css-resources', urls.length + ' CSS-Ressourcen');

    var results = await bgFetchBatch(urls, mode === 'zip' ? 'arrayBuffer' : 'base64');

    for (var k = 0; k < urlMatches.length; k++) {
      var m = urlMatches[k];
      var mAbsUrl = toAbsolute(m.url, baseUrl);
      if (!mAbsUrl || !results[mAbsUrl]) continue;

      var res = results[mAbsUrl];
      if (mode === 'zip') {
        var assetPath = registerZipAsset(zipAssets, mAbsUrl, 'assets/', res);
        cssText = cssText.replace(m.full, 'url(' + m.quote + assetPath + m.quote + ')');
      } else {
        cssText = cssText.replace(m.full, 'url(' + m.quote + res.data + m.quote + ')');
      }
    }

    return cssText;
  }

  // ─── Resource Embedding Functions ──────────────────────────

  async function embedStyles(doc, mode, zipAssets) {
    reportProgress('styles', 'CSS-Stylesheets verarbeiten...');

    // Process <link rel="stylesheet">
    var links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    var linkUrls = [];
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (href) {
        var abs = toAbsolute(href, window.location.href);
        if (abs) linkUrls.push(abs);
      }
    }

    totalResources += linkUrls.length;

    // Fetch all stylesheets in parallel
    var cssResults = await bgFetchBatch(linkUrls, 'text');

    for (var j = 0; j < links.length; j++) {
      var link = links[j];
      var lHref = link.getAttribute('href');
      if (!lHref) continue;

      var absUrl = toAbsolute(lHref, window.location.href);
      if (!absUrl || !cssResults[absUrl] || !cssResults[absUrl].data) continue;

      var cssText = cssResults[absUrl].data;
      cssText = await processCSS(cssText, absUrl, mode, zipAssets);

      var style = doc.createElement('style');
      style.textContent = cssText;
      // Preserve media attribute if present
      var media = link.getAttribute('media');
      if (media) style.setAttribute('media', media);
      link.parentNode.replaceChild(style, link);
    }

    // Process existing inline <style> tags
    var inlineStyles = Array.from(doc.querySelectorAll('style'));
    for (var k = 0; k < inlineStyles.length; k++) {
      inlineStyles[k].textContent = await processCSS(inlineStyles[k].textContent, window.location.href, mode, zipAssets);
    }
  }

  async function embedImages(doc, mode, zipAssets) {
    reportProgress('images', 'Bilder verarbeiten...');

    // Regular img src
    var images = Array.from(doc.querySelectorAll('img[src]'));
    var imgUrls = [];
    for (var i = 0; i < images.length; i++) {
      var src = images[i].getAttribute('src');
      if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
        var abs = toAbsolute(src, window.location.href);
        if (abs) imgUrls.push(abs);
      }
    }

    totalResources += imgUrls.length;

    var responseType = mode === 'zip' ? 'arrayBuffer' : 'base64';
    var results = await bgFetchBatch(imgUrls, responseType);

    for (var j = 0; j < images.length; j++) {
      var img = images[j];
      var imgSrc = img.getAttribute('src');
      if (!imgSrc || imgSrc.startsWith('data:') || imgSrc.startsWith('blob:')) continue;

      var absUrl = toAbsolute(imgSrc, window.location.href);
      if (!absUrl || !results[absUrl]) continue;

      var res = results[absUrl];
      if (mode === 'zip') {
        var assetPath = registerZipAsset(zipAssets, absUrl, 'assets/img/', res);
        img.setAttribute('src', assetPath);
      } else {
        img.setAttribute('src', res.data);
      }
    }

    // srcset attributes on <img> and <source>
    await embedSrcset(doc, mode, zipAssets);
  }

  async function embedSrcset(doc, mode, zipAssets) {
    var elements = Array.from(doc.querySelectorAll('[srcset]'));
    if (elements.length === 0) return;

    reportProgress('srcset', 'Responsive Bilder verarbeiten...');

    // Collect all srcset URLs
    var allUrls = [];
    for (var i = 0; i < elements.length; i++) {
      var srcset = elements[i].getAttribute('srcset');
      if (!srcset) continue;
      var entries = parseSrcset(srcset);
      for (var j = 0; j < entries.length; j++) {
        var absUrl = toAbsolute(entries[j].url, window.location.href);
        if (absUrl && !absUrl.startsWith('data:')) allUrls.push(absUrl);
      }
    }

    totalResources += allUrls.length;
    var responseType = mode === 'zip' ? 'arrayBuffer' : 'base64';
    var results = await bgFetchBatch(allUrls, responseType);

    for (var k = 0; k < elements.length; k++) {
      var el = elements[k];
      var elSrcset = el.getAttribute('srcset');
      if (!elSrcset) continue;

      var elEntries = parseSrcset(elSrcset);
      var newEntries = [];

      for (var m = 0; m < elEntries.length; m++) {
        var entry = elEntries[m];
        var eAbsUrl = toAbsolute(entry.url, window.location.href);
        if (!eAbsUrl || !results[eAbsUrl]) {
          newEntries.push(entry.url + ' ' + entry.descriptor);
          continue;
        }

        var res = results[eAbsUrl];
        if (mode === 'zip') {
          var assetPath = registerZipAsset(zipAssets, eAbsUrl, 'assets/img/', res);
          newEntries.push(assetPath + ' ' + entry.descriptor);
        } else {
          newEntries.push(res.data + ' ' + entry.descriptor);
        }
      }

      el.setAttribute('srcset', newEntries.join(', '));
    }
  }

  function parseSrcset(srcset) {
    // Robust srcset parser: only split on commas followed by whitespace+URL
    // This avoids breaking URLs that contain commas (e.g. query params)
    var entries = [];
    var remaining = srcset.trim();

    while (remaining) {
      // Skip leading whitespace and commas
      remaining = remaining.replace(/^[\s,]+/, '');
      if (!remaining) break;

      // Extract URL (everything up to first whitespace)
      var urlMatch = remaining.match(/^(\S+)/);
      if (!urlMatch) break;
      var url = urlMatch[1];
      remaining = remaining.substring(url.length).trim();

      // Extract descriptor (e.g. "2x", "300w") — ends at comma or end of string
      var descriptor = '';
      var descMatch = remaining.match(/^([^,]*)/);
      if (descMatch) {
        descriptor = descMatch[1].trim();
        remaining = remaining.substring(descMatch[0].length);
      }

      if (url) {
        entries.push({ url: url, descriptor: descriptor });
      }
    }
    return entries;
  }

  async function embedSVGs(doc, mode, zipAssets) {
    reportProgress('svgs', 'SVGs verarbeiten...');

    // <object data="*.svg">
    var svgObjects = Array.from(doc.querySelectorAll('object[data]'));
    var objUrls = [];
    for (var i = 0; i < svgObjects.length; i++) {
      var data = svgObjects[i].getAttribute('data');
      if (data && !data.startsWith('data:')) {
        var abs = toAbsolute(data, window.location.href);
        if (abs) objUrls.push(abs);
      }
    }

    if (objUrls.length === 0) return;

    totalResources += objUrls.length;
    var responseType = mode === 'zip' ? 'arrayBuffer' : 'base64';
    var results = await bgFetchBatch(objUrls, responseType);

    for (var j = 0; j < svgObjects.length; j++) {
      var obj = svgObjects[j];
      var objData = obj.getAttribute('data');
      if (!objData || objData.startsWith('data:')) continue;

      var absUrl = toAbsolute(objData, window.location.href);
      if (!absUrl || !results[absUrl]) continue;

      var res = results[absUrl];
      if (mode === 'zip') {
        var assetPath = registerZipAsset(zipAssets, absUrl, 'assets/svg/', res);
        obj.setAttribute('data', assetPath);
      } else {
        obj.setAttribute('data', res.data);
      }
    }
  }

  async function embedBackgroundImages(doc, mode, zipAssets) {
    reportProgress('backgrounds', 'Hintergrundbilder verarbeiten...');

    var elements = Array.from(doc.querySelectorAll('[style]'));
    var bgUrlPattern = /url\(\s*['"]?(?!data:|blob:)([^'")\s]+)['"]?\s*\)/g;

    // Collect all background image URLs
    var allUrls = [];
    for (var i = 0; i < elements.length; i++) {
      var style = elements[i].getAttribute('style');
      if (!style || style.indexOf('url(') === -1) continue;
      var match;
      bgUrlPattern.lastIndex = 0;
      while ((match = bgUrlPattern.exec(style)) !== null) {
        var absUrl = toAbsolute(match[1], window.location.href);
        if (absUrl) allUrls.push(absUrl);
      }
    }

    if (allUrls.length === 0) return;

    totalResources += allUrls.length;
    var responseType = mode === 'zip' ? 'arrayBuffer' : 'base64';
    var results = await bgFetchBatch(allUrls, responseType);

    for (var j = 0; j < elements.length; j++) {
      var el = elements[j];
      var elStyle = el.getAttribute('style');
      if (!elStyle || elStyle.indexOf('url(') === -1) continue;

      var newStyle = elStyle;
      var matches = Array.from(elStyle.matchAll(/url\(\s*(['"]?)(?!data:|blob:)([^'")\s]+)\1\s*\)/g));

      for (var k = 0; k < matches.length; k++) {
        var m = matches[k];
        var mAbsUrl = toAbsolute(m[2], window.location.href);
        if (!mAbsUrl || !results[mAbsUrl]) continue;

        var res = results[mAbsUrl];
        if (mode === 'zip') {
          var assetPath = registerZipAsset(zipAssets, mAbsUrl, 'assets/bg/', res);
          newStyle = newStyle.replace(m[0], "url('" + assetPath + "')");
        } else {
          newStyle = newStyle.replace(m[0], "url('" + res.data + "')");
        }
      }

      el.setAttribute('style', newStyle);
    }
  }

  async function embedFavicons(doc, mode, zipAssets) {
    reportProgress('favicons', 'Favicons verarbeiten...');

    var favicons = Array.from(doc.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]'));
    var faviconUrls = [];
    for (var i = 0; i < favicons.length; i++) {
      var href = favicons[i].getAttribute('href');
      if (href && !href.startsWith('data:')) {
        var abs = toAbsolute(href, window.location.href);
        if (abs) faviconUrls.push(abs);
      }
    }

    if (faviconUrls.length === 0) return;

    totalResources += faviconUrls.length;
    var responseType = mode === 'zip' ? 'arrayBuffer' : 'base64';
    var results = await bgFetchBatch(faviconUrls, responseType);

    for (var j = 0; j < favicons.length; j++) {
      var favicon = favicons[j];
      var fHref = favicon.getAttribute('href');
      if (!fHref || fHref.startsWith('data:')) continue;

      var absUrl = toAbsolute(fHref, window.location.href);
      if (!absUrl || !results[absUrl]) continue;

      var res = results[absUrl];
      if (mode === 'zip') {
        var assetPath = registerZipAsset(zipAssets, absUrl, 'assets/', res);
        favicon.setAttribute('href', assetPath);
      } else {
        favicon.setAttribute('href', res.data);
      }
    }
  }

  async function embedScripts(doc, mode, zipAssets) {
    reportProgress('scripts', 'JavaScript verarbeiten...');

    var scripts = Array.from(doc.querySelectorAll('script[src]'));
    var scriptUrls = [];
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src');
      if (src && !src.startsWith('data:')) {
        var abs = toAbsolute(src, window.location.href);
        if (abs) scriptUrls.push(abs);
      }
    }

    if (scriptUrls.length === 0) return;

    totalResources += scriptUrls.length;

    if (mode === 'zip') {
      var results = await bgFetchBatch(scriptUrls, 'text');

      for (var j = 0; j < scripts.length; j++) {
        var script = scripts[j];
        var sSrc = script.getAttribute('src');
        if (!sSrc || sSrc.startsWith('data:')) continue;

        var absUrl = toAbsolute(sSrc, window.location.href);
        if (!absUrl || !results[absUrl]) continue;

        var res = results[absUrl];
        // For scripts, pass text data via a wrapper object
        var scriptRes = { data: res.data, text: res.data, contentType: 'text/javascript' };
        var assetPath = registerZipAsset(zipAssets, absUrl, 'assets/js/', scriptRes);
        script.setAttribute('src', assetPath);
      }
    } else {
      // Inline mode: embed scripts directly
      var inlineResults = await bgFetchBatch(scriptUrls, 'text');

      for (var k = 0; k < scripts.length; k++) {
        var inScript = scripts[k];
        var inSrc = inScript.getAttribute('src');
        if (!inSrc || inSrc.startsWith('data:')) continue;

        var inAbsUrl = toAbsolute(inSrc, window.location.href);
        if (!inAbsUrl || !inlineResults[inAbsUrl]) continue;

        var inlineScript = doc.createElement('script');
        var attrs = inScript.attributes;
        for (var a = 0; a < attrs.length; a++) {
          if (attrs[a].name !== 'src') {
            inlineScript.setAttribute(attrs[a].name, attrs[a].value);
          }
        }
        inlineScript.textContent = inlineResults[inAbsUrl].data;
        inScript.parentNode.replaceChild(inlineScript, inScript);
      }
    }
  }

  async function embedVideoPosterAndSources(doc, mode, zipAssets) {
    reportProgress('media', 'Video/Audio-Poster verarbeiten...');

    // Video poster attributes
    var posters = Array.from(doc.querySelectorAll('video[poster]'));
    var posterUrls = [];
    for (var i = 0; i < posters.length; i++) {
      var poster = posters[i].getAttribute('poster');
      if (poster && !poster.startsWith('data:')) {
        var abs = toAbsolute(poster, window.location.href);
        if (abs) posterUrls.push(abs);
      }
    }

    if (posterUrls.length === 0) return;

    totalResources += posterUrls.length;
    var responseType = mode === 'zip' ? 'arrayBuffer' : 'base64';
    var results = await bgFetchBatch(posterUrls, responseType);

    for (var j = 0; j < posters.length; j++) {
      var video = posters[j];
      var vPoster = video.getAttribute('poster');
      if (!vPoster || vPoster.startsWith('data:')) continue;

      var absUrl = toAbsolute(vPoster, window.location.href);
      if (!absUrl || !results[absUrl]) continue;

      var res = results[absUrl];
      if (mode === 'zip') {
        var assetPath = registerZipAsset(zipAssets, absUrl, 'assets/img/', res);
        video.setAttribute('poster', assetPath);
      } else {
        video.setAttribute('poster', res.data);
      }
    }
  }

  async function embedPreloadedResources(doc, mode, zipAssets) {
    var preloads = Array.from(doc.querySelectorAll('link[rel="preload"][href]'));
    var relevantPreloads = [];
    for (var i = 0; i < preloads.length; i++) {
      var as = preloads[i].getAttribute('as');
      if (as === 'image' || as === 'font' || as === 'style') {
        relevantPreloads.push(preloads[i]);
      }
    }

    if (relevantPreloads.length === 0) return;

    reportProgress('preload', 'Preload-Ressourcen verarbeiten...');

    var preloadUrls = [];
    for (var j = 0; j < relevantPreloads.length; j++) {
      var abs = toAbsolute(relevantPreloads[j].getAttribute('href'), window.location.href);
      if (abs) preloadUrls.push(abs);
    }

    totalResources += preloadUrls.length;
    var responseType = mode === 'zip' ? 'arrayBuffer' : 'base64';
    var results = await bgFetchBatch(preloadUrls, responseType);

    for (var k = 0; k < relevantPreloads.length; k++) {
      var link = relevantPreloads[k];
      var lHref = link.getAttribute('href');
      if (!lHref) continue;

      var absUrl = toAbsolute(lHref, window.location.href);
      if (!absUrl || !results[absUrl]) continue;

      var res = results[absUrl];
      if (mode === 'zip') {
        var asType = link.getAttribute('as');
        var subdir = asType === 'font' ? 'fonts' : asType === 'image' ? 'img' : 'css';
        var assetPath = registerZipAsset(zipAssets, absUrl, 'assets/' + subdir + '/', res);
        link.setAttribute('href', assetPath);
      } else {
        link.setAttribute('href', res.data);
      }
    }
  }

  // ─── Computed Style Background Images ──────────────────────

  /**
   * Find elements with background images set via CSS rules (not inline style).
   * We read computed styles from the live DOM, then apply them to the clone.
   */
  function collectComputedBackgrounds() {
    var backgrounds = new Map();
    var all = document.querySelectorAll('*');

    for (var i = 0; i < all.length; i++) {
      try {
        var computed = window.getComputedStyle(all[i]);
        var bgImage = computed.getPropertyValue('background-image');
        if (bgImage && bgImage !== 'none' && bgImage.indexOf('url(') !== -1) {
          var path = getElementPath(all[i]);
          if (path) {
            backgrounds.set(path, bgImage);
          }
        }
      } catch (e) {
        // Skip inaccessible elements
      }
    }
    return backgrounds;
  }

  function getElementPath(el) {
    var parts = [];
    var current = el;
    while (current && current !== document.documentElement) {
      if (current.id) {
        parts.unshift('#' + CSS.escape(current.id));
        break;
      }
      var parent = current.parentElement;
      if (!parent) break;
      var children = Array.from(parent.children);
      var index = children.indexOf(current);
      var tag = current.tagName.toLowerCase();
      parts.unshift(tag + ':nth-child(' + (index + 1) + ')');
      current = parent;
    }
    return parts.join(' > ');
  }

  async function embedComputedBackgrounds(doc, mode, zipAssets) {
    reportProgress('computed-bg', 'CSS-Hintergrundbilder aus Stylesheets verarbeiten...');

    var backgrounds = collectComputedBackgrounds();
    if (backgrounds.size === 0) return;

    // Collect all URLs from background-image values
    var allUrls = [];
    var urlPattern = /url\(\s*['"]?(?!data:|blob:)([^'")\s]+)['"]?\s*\)/g;

    backgrounds.forEach(function(bgValue) {
      var match;
      urlPattern.lastIndex = 0;
      while ((match = urlPattern.exec(bgValue)) !== null) {
        var absUrl = toAbsolute(match[1], window.location.href);
        if (absUrl) allUrls.push(absUrl);
      }
    });

    if (allUrls.length === 0) return;

    totalResources += allUrls.length;
    var responseType = mode === 'zip' ? 'arrayBuffer' : 'base64';
    var results = await bgFetchBatch(allUrls, responseType);

    // Apply backgrounds to cloned elements
    backgrounds.forEach(function(bgValue, path) {
      try {
        var cloneEl = doc.querySelector(path);
        if (!cloneEl) return;

        var newBg = bgValue;
        var matches = Array.from(bgValue.matchAll(/url\(\s*(['"]?)(?!data:|blob:)([^'")\s]+)\1\s*\)/g));

        for (var i = 0; i < matches.length; i++) {
          var m = matches[i];
          var absUrl = toAbsolute(m[2], window.location.href);
          if (!absUrl || !results[absUrl]) continue;

          var res = results[absUrl];
          if (mode === 'zip') {
            var assetPath = registerZipAsset(zipAssets, absUrl, 'assets/bg/', res);
            newBg = newBg.replace(m[0], "url('" + assetPath + "')");
          } else {
            newBg = newBg.replace(m[0], "url('" + res.data + "')");
          }
        }

        // Set as inline style (preserving existing inline styles)
        var existing = cloneEl.getAttribute('style') || '';
        cloneEl.setAttribute('style', existing + (existing ? '; ' : '') + 'background-image: ' + newBg);
      } catch (e) {
        // Skip elements we can't find in clone
      }
    });
  }

  // ─── Main Download Function ────────────────────────────────

  async function downloadPageAsHTML(mode) {
    mode = mode || 'zip';
    try {
      // Reset counters
      totalResources = 0;
      loadedResources = 0;
      failedResources = 0;
      resourceCache.clear();
      usedAssetPaths.clear();

      reportProgress('start', 'Seite wird analysiert...');

      // Clone the document
      var clone = document.documentElement.cloneNode(true);
      var doc = document.implementation.createHTMLDocument();
      doc.documentElement.replaceWith(clone);

      // ZIP asset map: url -> { path, base64/text, contentType }
      var zipAssets = new Map();

      // Ensure charset meta tag
      if (!doc.querySelector('meta[charset]')) {
        var meta = doc.createElement('meta');
        meta.setAttribute('charset', 'UTF-8');
        if (doc.head && doc.head.firstChild) {
          doc.head.insertBefore(meta, doc.head.firstChild);
        } else if (doc.head) {
          doc.head.appendChild(meta);
        }
      }

      // Process all resource types
      await embedStyles(doc, mode, zipAssets);
      await embedImages(doc, mode, zipAssets);
      await embedSVGs(doc, mode, zipAssets);
      await embedBackgroundImages(doc, mode, zipAssets);
      await embedComputedBackgrounds(doc, mode, zipAssets);
      await embedFavicons(doc, mode, zipAssets);
      await embedScripts(doc, mode, zipAssets);
      await embedVideoPosterAndSources(doc, mode, zipAssets);
      await embedPreloadedResources(doc, mode, zipAssets);

      reportProgress('generating', 'Datei wird erstellt...');

      // Generate filename base
      var pageTitle = document.title.replace(/[^a-z0-9\u00e4\u00f6\u00fc\u00df]/gi, '_').replace(/_+/g, '_').toLowerCase() || 'website';
      var timestamp = new Date().toISOString().split('T')[0];
      var filenameBase = pageTitle + '_' + timestamp;

      // Generate HTML string
      var htmlContent = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;

      if (mode === 'zip') {
        return await downloadAsZip(htmlContent, zipAssets, filenameBase);
      } else {
        return await downloadAsSingleHTML(htmlContent, filenameBase);
      }
    } catch (error) {
      console.error('[SiteLoader] Download error:', error);
      return { success: false, error: error.message };
    }
  }

  async function downloadAsSingleHTML(htmlContent, filenameBase) {
    var blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var filename = filenameBase + '.html';

    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    var container = document.body || document.documentElement;
    container.appendChild(a);
    a.click();
    container.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 5000);

    reportProgress('done', filename + ' heruntergeladen');
    return {
      success: true,
      filename: filename,
      stats: { total: totalResources, loaded: loadedResources, failed: failedResources }
    };
  }

  async function downloadAsZip(htmlContent, zipAssets, filenameBase) {
    if (typeof JSZip === 'undefined') {
      // Fallback: try loading JSZip
      console.warn('[SiteLoader] JSZip not available, falling back to single HTML');
      return await downloadAsSingleHTML(htmlContent, filenameBase);
    }

    var zip = new JSZip();

    // Add main HTML file
    zip.file('index.html', htmlContent);

    // Add all assets
    zipAssets.forEach(function(asset, url) {
      try {
        if (asset.text !== undefined) {
          zip.file(asset.path, asset.text);
        } else if (asset.base64) {
          zip.file(asset.path, asset.base64, { base64: true });
        }
      } catch (error) {
        console.warn('[SiteLoader] ZIP add error:', asset.path, error);
      }
    });

    reportProgress('compressing', 'ZIP wird komprimiert (' + zipAssets.size + ' Dateien)...');

    var zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    }, function(metadata) {
      reportProgress('compressing', 'Komprimierung: ' + Math.round(metadata.percent) + '%');
    });

    var blobUrl = URL.createObjectURL(zipBlob);
    var filename = filenameBase + '.zip';

    var a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    var container = document.body || document.documentElement;
    container.appendChild(a);
    a.click();
    container.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 5000);

    reportProgress('done', filename + ' heruntergeladen (' + zipAssets.size + ' Ressourcen)');
    return {
      success: true,
      filename: filename,
      stats: { total: totalResources, loaded: loadedResources, failed: failedResources, assets: zipAssets.size }
    };
  }

  // ─── Message Listener ──────────────────────────────────────

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'downloadPage') {
      var mode = request.mode || 'zip';
      downloadPageAsHTML(mode).then(sendResponse);
      return true; // Async response
    }
  });
})();
