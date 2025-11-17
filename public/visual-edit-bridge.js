// ===== LOVIVO VISUAL EDIT BRIDGE =====
// Professional visual editing mode - Industry best practices implementation
// Based on research from Lovable, Bolt, and leading CSS selector libraries

(function () {
  'use strict';

  // ===== PHASE 1: ENVIRONMENT VERIFICATION =====
  
  // Only run inside an iframe
  if (window.self === window.top) {
    console.log('[Lovivo Visual Edit] Not in iframe, skipping initialization');
    return;
  }

  console.log('🎨 Lovivo Visual Edit Bridge - Professional Edition');

  // ===== MESSAGE TYPES ENUM =====
  
  const MESSAGE_TYPES = {
    // Parent → Iframe
    ACTIVATE: 'VISUAL_EDIT_MODE_ACTIVATE',
    DEACTIVATE: 'VISUAL_EDIT_MODE_DEACTIVATE',
    DETECT: 'VISUAL_EDIT_DETECT_ELEMENT',
    HIGHLIGHT: 'VISUAL_EDIT_HIGHLIGHT',
    CLEAR_HIGHLIGHT: 'VISUAL_EDIT_CLEAR_HIGHLIGHT',
    REQUEST_INFO: 'VISUAL_EDIT_REQUEST_INFO',
    
    // Iframe → Parent
    ELEMENT_HOVERED: 'ELEMENT_HOVERED',
    ELEMENT_CLICKED: 'ELEMENT_CLICKED',
    ELEMENT_INFO: 'ELEMENT_INFO',
    NO_ELEMENT: 'NO_ELEMENT_DETECTED',
    ERROR: 'VISUAL_EDIT_ERROR',
    READY: 'VISUAL_EDIT_READY'
  };

  // ===== GLOBAL STATE =====
  
  const state = {
    isActive: false,
    isHovering: false,
    eventListenersAttached: false,
    currentHighlightedElement: null,
    currentSelectedElement: null,
    selectorCache: new WeakMap(),
    
    // Performance tracking
    lastHoveredSelector: null,
    lastDetectionTime: 0,
    pendingDetection: null,
    
    // Configuration
    config: {
      timeout: 1000,
      maxDepth: 10,
      preferDataAttributes: true,
      filterTailwind: true,
      throttleMs:50, // ~60fps (16ms per frame)
      enableDebug: false,
      allowedOrigins: [], // Allowed message origins for security (incoming)
      strictOriginCheck: false, // Set to true to enforce strict origin validation
      parentOrigin: null, // Target origin for outgoing messages
      autoDetectParent: true // Auto-detect parent origin from referrer
    },
    
    // Overlays
    overlays: {
      hover: null,
      selected: null,
      tooltip: null
    },
    
    // RAF and timers
    rafId: null,
    scrollHandlerId: null
  };

  // ===== PHASE 2: SELECTOR GENERATION - WORLD CLASS =====

  /**
   * Detect if a class name is a Tailwind utility class
   * These are not semantic and should be filtered out
   */
  function isTailwindUtility(className) {
    const tailwindPatterns = [
      /^(p|m)(t|r|b|l|x|y)?-\d+$/,                    // padding, margin
      /^-?(p|m)(t|r|b|l|x|y)?-\d+$/,                  // negative spacing
      /^(w|h|min-w|min-h|max-w|max-h)-/,              // sizing
      /^text-(xs|sm|base|lg|xl|\d*xl|center|left|right)/, // text
      /^(flex|grid|block|inline|hidden)/,             // display
      /^(bg|text|border|ring|shadow|outline)-/,       // colors & effects
      /^(rounded|opacity|cursor|select)-/,            // effects
      /^(absolute|relative|fixed|sticky)/,            // position
      /^(top|right|bottom|left|inset|z)-/,           // positioning
      /^(justify|items|content|self|place)-/,        // alignment
      /^(gap|space)-/,                                // spacing
      /^(transition|duration|ease|delay|animate)-/,   // transitions
      /^(hover|focus|active|disabled|group-hover):/,  // pseudo-classes
      /^(sm|md|lg|xl|2xl):/,                         // breakpoints
      /^(overflow|object|aspect|container)/,          // layout
      /^(font|leading|tracking|decoration)/,          // typography
      /^(divide|border-[trbl])/,                     // borders
      /^(col|row)-/                                   // grid
    ];
    
    return tailwindPatterns.some(pattern => pattern.test(className));
  }

  /**
   * Get only semantic class names (filter out Tailwind utilities)
   */
  function getSemanticClasses(element) {
    if (!element.className || typeof element.className !== 'string') {
      return [];
    }
    
    return element.className
      .trim()
      .split(/\s+/)
      .filter(className => {
        return className && 
               !isTailwindUtility(className) &&
               className.length > 0 &&
               className.length < 50; // Avoid generated class names
      });
  }

  /**
   * Get data-* attributes from element
   */
  function getDataAttributes(element) {
    const dataAttrs = [];
    
    if (element.attributes) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        if (attr.name.startsWith('data-')) {
          dataAttrs.push({
            name: attr.name,
            value: attr.value
          });
        }
      }
    }
    
    return dataAttrs;
  }

  /**
   * Check if an ID is valid and usable
   */
  function isValidId(id) {
    return id && 
           typeof id === 'string' &&
           id.length > 0 &&
           id.length < 50 &&
           !/^[0-9]/.test(id) &&     // Doesn't start with number
           !/\s/.test(id) &&          // No spaces
           !/^react-/.test(id) &&     // Not React-generated
           !/^__/.test(id);           // Not internal
  }

  /**
   * Check if a selector is unique in the document
   */
  function isUnique(selector, targetElement = null) {
    try {
      const elements = document.querySelectorAll(selector);
      
      if (targetElement) {
        return elements.length === 1 && elements[0] === targetElement;
      }
      
      return elements.length === 1;
    } catch (e) {
      return false;
    }
  }

  /**
   * Build a selector part for a single element
   */
  function buildSelectorPart(element, useNth = false) {
    let selector = element.tagName.toLowerCase();
    
    // Add semantic classes (max 2)
    const classes = getSemanticClasses(element).slice(0, 2);
    if (classes.length > 0) {
      selector += '.' + classes.map(c => CSS.escape(c)).join('.');
    }
    
    // Add nth-of-type if needed
    if (useNth && element.parentElement) {
      const siblings = Array.from(element.parentElement.children)
        .filter(el => el.tagName === element.tagName);
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(element) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    
    return selector;
  }

  /**
   * Build path from element to root
   */
  function buildPathToRoot(element, root, maxDepth) {
    const path = [];
    let current = element;
    let depth = 0;
    
    while (current && current !== root && depth < maxDepth) {
      const part = buildSelectorPart(current, false);
      path.unshift(part);
      current = current.parentElement;
      depth++;
    }
    
    return path.join(' > ');
  }

  /**
   * Optimize path by removing unnecessary parts
   */
  function optimizePath(path, targetElement) {
    const parts = path.split(' > ');
    
    // Try removing parts from the beginning
    for (let i = 0; i < parts.length - 1; i++) {
      const shorterPath = parts.slice(i).join(' > ');
      if (isUnique(shorterPath, targetElement)) {
        return shorterPath;
      }
    }
    
    return path;
  }

  /**
   * Build fallback selector using nth-of-type
   */
  function buildNthTypePath(element, root) {
    const path = [];
    let current = element;
    
    while (current && current !== root) {
      const part = buildSelectorPart(current, true);
      path.unshift(part);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }

  /**
   * MAIN SELECTOR GENERATOR
   * Uses industry best practices from @medv/finder and css-selector-generator
   */
  function generateOptimalSelector(element, options = {}) {
    if (!element || element === document.documentElement) {
      return null;
    }
    
    const {
      root = document.body,
      timeout = state.config.timeout,
      maxDepth = state.config.maxDepth,
      preferDataAttributes = state.config.preferDataAttributes
    } = options;
    
    const startTime = Date.now();
    
    // Check cache first
    if (state.selectorCache.has(element)) {
      const cached = state.selectorCache.get(element);
      if (isUnique(cached, element)) {
        return cached;
      }
    }
    
    // PRIORITY 1: Valid ID
    if (element.id && isValidId(element.id)) {
      const selector = `#${CSS.escape(element.id)}`;
      if (isUnique(selector, element)) {
        state.selectorCache.set(element, selector);
        return selector;
      }
    }
    
    // PRIORITY 2: Data attributes
    if (preferDataAttributes) {
      const dataAttrs = getDataAttributes(element);
      for (const attr of dataAttrs) {
        if (attr.value && attr.value.length < 50) {
          const selector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
          if (isUnique(selector, element)) {
            state.selectorCache.set(element, selector);
            return selector;
          }
        }
      }
    }
    
    // PRIORITY 3: Semantic classes combination
    const semanticClasses = getSemanticClasses(element);
    if (semanticClasses.length > 0) {
      const classSelector = '.' + semanticClasses
        .slice(0, 3)
        .map(c => CSS.escape(c))
        .join('.');
      
      if (isUnique(classSelector, element)) {
        state.selectorCache.set(element, classSelector);
        return classSelector;
      }
    }
    
    // PRIORITY 4: Tag + semantic classes
    const tag = element.tagName.toLowerCase();
    if (semanticClasses.length > 0) {
      const selector = tag + '.' + semanticClasses
        .slice(0, 2)
        .map(c => CSS.escape(c))
        .join('.');
      
      if (isUnique(selector, element)) {
        state.selectorCache.set(element, selector);
        return selector;
      }
    }
    
    // Check timeout
    if (Date.now() - startTime > timeout) {
      console.warn('[Lovivo Visual Edit] Selector generation timeout, using fallback');
      const fallback = buildNthTypePath(element, root);
      state.selectorCache.set(element, fallback);
      return fallback;
    }
    
    // PRIORITY 5: Build optimized path
    const path = buildPathToRoot(element, root, maxDepth);
    const optimized = optimizePath(path, element);
    
    if (isUnique(optimized, element)) {
      state.selectorCache.set(element, optimized);
      return optimized;
    }
    
    // PRIORITY 6: Fallback with nth-of-type
    const fallback = buildNthTypePath(element, root);
    
    // Validate fallback
    try {
      const testElement = document.querySelector(fallback);
      if (testElement === element) {
        state.selectorCache.set(element, fallback);
        return fallback;
      }
    } catch (e) {
      console.error('[Lovivo Visual Edit] Invalid fallback selector:', e);
      return null;
    }
    
    return null;
  }

  // ===== PHASE 3: PRECISE ELEMENT DETECTION =====

  /**
   * Adjust coordinates from parent window to iframe space
   */
  function adjustCoordinatesForIframe(parentX, parentY) {
    const iframe = window.frameElement;
    
    if (!iframe) {
      // Not in iframe, use coordinates as-is
      return { x: parentX, y: parentY };
    }
    
    try {
      const iframeRect = iframe.getBoundingClientRect();
      return {
        x: parentX - iframeRect.left - window.scrollX,
        y: parentY - iframeRect.top - window.scrollY
      };
    } catch (e) {
      console.warn('[Lovivo Visual Edit] Could not adjust coordinates:', e);
      return { x: parentX, y: parentY };
    }
  }

  /**
   * Check if element is significant (has content or is interactive)
   */
  function isSignificantElement(element) {
    // Interactive elements are always significant
    const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'VIDEO', 'AUDIO', 'IMG'];
    if (interactiveTags.includes(element.tagName)) {
      return true;
    }

    // Elements with semantic attributes
    if (element.hasAttribute('aria-label') || 
        element.hasAttribute('title') || 
        element.hasAttribute('role')) {
      return true;
    }

    // Heading elements
    if (/^H[1-6]$/.test(element.tagName)) {
      return true;
    }

    // Elements with direct text content (not just from children)
    const directText = Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent.trim())
      .join('');
    
    if (directText.length > 0) {
      return true;
    }

    // Check if element has substantial text in immediate children (like spans)
    const totalText = element.textContent?.trim() || '';
    if (totalText.length > 5) {
      // Has text content, but check if children are also semantic
      const firstChild = element.children[0];
      if (firstChild && /^(SPAN|STRONG|EM|B|I|P)$/.test(firstChild.tagName)) {
        return true;
      }
    }

    // Elements with specific semantic classes (not Tailwind utilities)
    const classList = Array.from(element.classList);
    const hasSemanticClass = classList.some(cls => {
      // Filter out Tailwind utility classes
      return !cls.match(/^(text-|bg-|p-|m-|flex|grid|w-|h-|from-|to-|via-|absolute|relative|fixed)/);
    });

    if (hasSemanticClass && classList.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Check if element is purely decorative (overlay/gradient)
   */
  function isDecorativeOverlay(element) {
    // Check if element has gradient/overlay classes
    const classList = Array.from(element.classList);
    
    // Common decorative patterns
    const decorativePatterns = [
      'gradient',
      'from-',
      'to-',
      'backdrop',
      'overlay',
      'bg-gradient',
      'shadow',
      'blur'
    ];
    
    const hasDecorativeClass = classList.some(cls => 
      decorativePatterns.some(pattern => cls.includes(pattern))
    );

    if (!hasDecorativeClass) {
      return false;
    }

    // If it has decorative classes, check if it also has meaningful content
    const hasText = element.textContent.trim().length > 0;
    const hasInteractiveChildren = Array.from(element.children).some(child => 
      ['A', 'BUTTON', 'INPUT'].includes(child.tagName)
    );
    
    // Decorative if: has decorative class AND no interactive children
    // Even if it has text, if the text is in child elements, it's wrapping decorative
    if (hasDecorativeClass && !hasInteractiveChildren) {
      // Check if it's just a wrapper (has children that could be the real target)
      if (element.children.length > 0) {
        return true; // It's a wrapper, skip to children
      }
      
      // No children and no text = pure decoration
      if (!hasText) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Detect element at coordinates with smart filtering
   * Prioritizes significant elements over decorative overlays
   */
  function detectElementAtPoint(x, y) {
    // Get all elements at point (in case of overlays)
    const elements = document.elementsFromPoint(x, y);
    
    if (!elements || elements.length === 0) {
      return null;
    }
    
    // Debug: Log all detected elements
    if (state.config.enableDebug) {
      console.log('[Lovivo Visual Edit] Elements at point:', elements.map(el => ({
        tag: el.tagName,
        classes: Array.from(el.classList).join(' '),
        text: el.textContent?.substring(0, 30)
      })));
    }
    
    // Filter and score elements
    const candidates = elements.filter(el => {
      // Ignore our overlays
      if (el === state.overlays.hover || 
          el === state.overlays.selected || 
          el === state.overlays.tooltip) {
        return false;
      }
      
      // Ignore document elements
      if (el === document.documentElement || el === document.body) {
        return false;
      }
      
      return true;
    });

    if (candidates.length === 0) {
      return null;
    }

    // Strategy: Find the most significant element
    // Priority:
    // 1. Interactive elements (buttons, links, inputs)
    // 2. Elements with text content
    // 3. Elements with semantic meaning
    // 4. Skip purely decorative overlays

    // First pass: Find interactive or highly significant elements
    for (const el of candidates) {
      const isSignificant = isSignificantElement(el);
      const isDecorative = isDecorativeOverlay(el);
      
      if (state.config.enableDebug) {
        console.log('[Lovivo Visual Edit] Checking element:', {
          tag: el.tagName,
          classes: Array.from(el.classList).slice(0, 3).join(' '),
          isSignificant,
          isDecorative
        });
      }
      
      if (isSignificant && !isDecorative) {
        if (state.config.enableDebug) {
          console.log('[Lovivo Visual Edit] ✅ Selected (significant):', el.tagName);
        }
        return el;
      }
    }

    // Second pass: Return first non-decorative element
    for (const el of candidates) {
      if (!isDecorativeOverlay(el)) {
        if (state.config.enableDebug) {
          console.log('[Lovivo Visual Edit] ✅ Selected (non-decorative):', el.tagName);
        }
        return el;
      }
    }

    // Fallback: Return first valid element (even if decorative)
    if (state.config.enableDebug) {
      console.log('[Lovivo Visual Edit] ⚠️ Fallback to first element:', candidates[0]?.tagName);
    }
    return candidates[0] || null;
  }

  // ===== PHASE 4: PROFESSIONAL OVERLAY SYSTEM =====

  /**
   * Create hover overlay with modern styling
   */
  function createHoverOverlay() {
    if (state.overlays.hover) return state.overlays.hover;

    const overlay = document.createElement('div');
    overlay.id = 'lovivo-visual-edit-hover';
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      z-index: 2147483646;
      transition: all 150ms ease;
      display: none;
      box-sizing: border-box;
    `;
    document.body.appendChild(overlay);
    state.overlays.hover = overlay;
    return overlay;
  }

  /**
   * Create selection overlay (different color)
   */
  function createSelectionOverlay() {
    if (state.overlays.selected) return state.overlays.selected;

    const overlay = document.createElement('div');
    overlay.id = 'lovivo-visual-edit-selected';
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #10b981;
      background: rgba(16, 185, 129, 0.15);
      z-index: 2147483645;
      display: none;
      box-sizing: border-box;
    `;
    document.body.appendChild(overlay);
    state.overlays.selected = overlay;
    return overlay;
  }

  /**
   * Create tooltip for element information
   */
  function createTooltip() {
    if (state.overlays.tooltip) return state.overlays.tooltip;

    const tooltip = document.createElement('div');
    tooltip.id = 'lovivo-visual-edit-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      pointer-events: none;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 11px;
      z-index: 2147483647;
      display: none;
      max-width: 300px;
      word-break: break-word;
      line-height: 1.4;
    `;
    document.body.appendChild(tooltip);
    state.overlays.tooltip = tooltip;
    return tooltip;
  }

  /**
   * Update overlay position for an element
   */
  function updateOverlayPosition(overlay, element) {
    if (!overlay || !element) return;

    const rect = element.getBoundingClientRect();
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.display = 'block';
  }

  /**
   * Position tooltip near element without blocking view
   */
  function positionTooltip(tooltip, element) {
    if (!tooltip || !element) return;

    const rect = element.getBoundingClientRect();
    const tooltipHeight = 30; // Approximate
    const spacing = 8;
    
    // Position above element if space available, otherwise below
    let top = rect.top - tooltipHeight - spacing;
    if (top < 0) {
      top = rect.bottom + spacing;
    }
    
    let left = rect.left;
    
    // Keep within viewport
    const maxLeft = window.innerWidth - 310; // 300px max-width + margin
    if (left > maxLeft) {
      left = maxLeft;
    }
    if (left < 0) {
      left = 0;
    }
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.display = 'block';
  }

  /**
   * Generate tooltip content for element
   */
  function generateTooltipContent(element, selector) {
    const tag = element.tagName.toLowerCase();
    const semanticClasses = getSemanticClasses(element);
    const id = element.id && isValidId(element.id) ? element.id : '';
    
    let content = `<strong>${tag}</strong>`;
    
    if (id) {
      content += ` <span style="color: #fbbf24;">#${id}</span>`;
    }
    
    if (semanticClasses.length > 0) {
      content += ` <span style="color: #60a5fa;">.${semanticClasses.slice(0, 2).join('.')}</span>`;
    }
    
    if (selector) {
      content += `<br><span style="color: #9ca3af; font-size: 10px;">${selector}</span>`;
    }
    
    return content;
  }

  /**
   * Highlight element on hover
   */
  function highlightElement(element, selector) {
    try {
      if (!element) {
        console.warn('[Lovivo Visual Edit] No element to highlight');
        return;
      }

      state.currentHighlightedElement = element;
      
      const overlay = createHoverOverlay();
      // Tooltip removed - parent window handles element info display

      // Update overlay position
      updateOverlayPosition(overlay, element);
      
      // Tooltip functionality removed - cleaner UI
      // The parent window will display element info in its own UI

      // Setup scroll/resize handlers if not already set
      if (!state.scrollHandlerId) {
        const updatePositions = () => {
          if (state.currentHighlightedElement) {
            updateOverlayPosition(overlay, state.currentHighlightedElement);
            // No tooltip to update
          }
        };
        
        state.scrollHandlerId = true;
        window.addEventListener('scroll', updatePositions, true);
        window.addEventListener('resize', updatePositions);
      }
    } catch (error) {
      console.error('[Lovivo Visual Edit] Error highlighting element:', error);
      sendMessage(MESSAGE_TYPES.ERROR, { error: error.message });
    }
  }

  /**
   * Clear hover highlight
   */
  function clearHighlight() {
    if (state.overlays.hover) {
      state.overlays.hover.style.display = 'none';
    }

    state.currentHighlightedElement = null;
  }

  /**
   * Show selection overlay for clicked element
   */
  function showSelection(element) {
    const overlay = createSelectionOverlay();
    state.currentSelectedElement = element;
    updateOverlayPosition(overlay, element);
  }

  /**
   * Clear selection overlay
   */
  function clearSelection() {
    if (state.overlays.selected) {
      state.overlays.selected.style.display = 'none';
    }
    state.currentSelectedElement = null;
  }

  /**
   * Get detailed information about an element
   */
  function getElementInfo(element) {
    if (!element) return null;

    const computedStyles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return {
      tagName: element.tagName,
      className: element.className,
      semanticClasses: getSemanticClasses(element),
      textContent: element.textContent?.substring(0, 100) || '',
      computedStyles: {
        color: computedStyles.color,
        backgroundColor: computedStyles.backgroundColor,
        fontSize: computedStyles.fontSize,
        padding: computedStyles.padding,
        margin: computedStyles.margin,
        width: computedStyles.width,
        height: computedStyles.height,
      },
      boundingRect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  // ===== PHASE 5: PERFORMANCE & EVENT HANDLING =====

  /**
   * Get current protocol (http or https)
   * Falls back to https if protocol is not standard
   */
  function getProtocol() {
    let protocol = location.protocol.replace(':', '');
    if (protocol !== 'http' && protocol !== 'https') {
      protocol = 'https';
    }
    return protocol;
  }

  /**
   * Auto-detect parent origin from document.referrer
   * @returns {string|null} The detected parent origin or null
   */
  function detectParentOrigin() {
    if (document.referrer) {
      try {
        const url = new URL(document.referrer);
        return url.origin;
      } catch (e) {
        console.warn('[Lovivo Visual Edit] Could not parse referrer:', e);
      }
    }
    return null;
  }

  /**
   * Get target origin for outgoing messages
   * @returns {string} The target origin or '*' as fallback
   */
  function getTargetOrigin() {
    // Use configured parentOrigin if available
    if (state.config.parentOrigin) {
      return state.config.parentOrigin;
    }
    
    // Auto-detect if enabled and not yet set
    if (state.config.autoDetectParent) {
      const detected = detectParentOrigin();
      if (detected) {
        state.config.parentOrigin = detected;
        if (state.config.enableDebug) {
          console.log('[Lovivo Visual Edit] Auto-detected parent origin:', detected);
        }
        return detected;
      }
    }
    
    // Fallback to wildcard (less secure but works everywhere)
    if (state.config.enableDebug) {
      console.warn('[Lovivo Visual Edit] Using wildcard origin (*)');
    }
    return '*';
  }

  /**
   * Send message to parent window with standard format and specific origin
   */
  function sendMessage(type, data = {}) {
    const targetOrigin = getTargetOrigin();
    
    try {
      window.parent.postMessage({
        source: 'lovivo-visual-edit-bridge',
        type,
        timestamp: Date.now(),
        ...data
      }, targetOrigin);
      
      if (state.config.enableDebug) {
        console.log('[Lovivo Visual Edit] Message sent:', { type, targetOrigin });
      }
    } catch (error) {
      console.error('[Lovivo Visual Edit] Error sending message:', error);
    }
  }

  /**
   * Prevent default behavior when Visual Edit is active
   */
  function preventDefaultBehavior(event) {
    if (state.isActive) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  /**
   * Handle element detection with throttling + deduplication
   * Industry best practices:
   * - RAF throttling (60fps max)
   * - Deduplication (don't send same selector twice)
   * - Time-based throttling (configurable)
   */
  function handleDetectElement(data) {
    const { x, y, action } = data;
    
    // Strategy 1: RAF Throttling - Only process one detection per frame
    if (state.rafId) {
      // Store latest pending detection to process after current frame
      state.pendingDetection = { x, y, action };
      return;
    }
    
    state.rafId = requestAnimationFrame(() => {
      try {
        // Strategy 2: Time-based Throttling - Configurable minimum interval
        const now = Date.now();
        const timeSinceLastDetection = now - state.lastDetectionTime;
        
        // For hover actions, enforce minimum time between detections
        if (action === 'hover' && timeSinceLastDetection < state.config.throttleMs) {
          state.rafId = null;
          
          // Process pending detection if exists
          if (state.pendingDetection) {
            const pending = state.pendingDetection;
            state.pendingDetection = null;
            handleDetectElement(pending);
          }
          return;
        }
        
        state.lastDetectionTime = now;
        
        // Adjust coordinates for iframe
        const adjusted = adjustCoordinatesForIframe(x, y);
        
        // Detect element at point
        const element = detectElementAtPoint(adjusted.x, adjusted.y);

        if (!element) {
          // Strategy 3: Deduplication - Only send if different from last
          if (state.lastHoveredSelector !== null) {
            state.lastHoveredSelector = null;
            sendMessage(MESSAGE_TYPES.NO_ELEMENT, { action });
            clearHighlight();
          }
          state.rafId = null;
          return;
        }

        // Generate optimal selector (cached for performance)
        const selector = generateOptimalSelector(element);

        if (!selector) {
          if (state.lastHoveredSelector !== null) {
            state.lastHoveredSelector = null;
            sendMessage(MESSAGE_TYPES.NO_ELEMENT, { action });
            clearHighlight();
          }
          state.rafId = null;
          return;
        }

        if (action === 'hover') {
          // Strategy 3: Deduplication - Only send/update if selector changed
          if (selector !== state.lastHoveredSelector) {
            state.lastHoveredSelector = selector;
            highlightElement(element, selector);
            sendMessage(MESSAGE_TYPES.ELEMENT_HOVERED, { selector });
            
            if (state.config.enableDebug) {
              console.log('[Lovivo Visual Edit] ✅ Hover changed to:', selector);
            }
          } else if (state.config.enableDebug) {
            // Same element - deduplicated, no message sent
            console.log('[Lovivo Visual Edit] ⏭️ Skipped (same element):', selector);
          }
        } else if (action === 'click') {
          // Clicks are always processed (user intent)
          state.lastHoveredSelector = selector;
          showSelection(element);
          sendMessage(MESSAGE_TYPES.ELEMENT_CLICKED, { selector });
          
          if (state.config.enableDebug) {
            console.log('[Lovivo Visual Edit] 🖱️ Click:', selector);
          }
        }
      } catch (error) {
        console.error('[Lovivo Visual Edit] Error detecting element:', error);
        sendMessage(MESSAGE_TYPES.ERROR, { 
          error: error.message,
          action 
        });
      } finally {
        state.rafId = null;
        
        // Process pending detection if exists
        if (state.pendingDetection) {
          const pending = state.pendingDetection;
          state.pendingDetection = null;
          handleDetectElement(pending);
        }
      }
    });
  }

  /**
   * Handle element info request
   */
  function handleRequestInfo(data) {
    const { selector } = data;

    try {
      const element = document.querySelector(selector);
      if (!element) {
        console.warn('[Lovivo Visual Edit] Element not found for info request:', selector);
        sendMessage(MESSAGE_TYPES.ERROR, { 
          error: 'Element not found',
          selector 
        });
        return;
      }

      const info = getElementInfo(element);

      sendMessage(MESSAGE_TYPES.ELEMENT_INFO, {
        selector,
        ...info,
      });
    } catch (error) {
      console.error('[Lovivo Visual Edit] Error getting element info:', error);
      sendMessage(MESSAGE_TYPES.ERROR, { 
        error: error.message,
        selector 
      });
    }
  }

  /**
   * Highlight element by selector (from parent command)
   */
  function handleHighlightBySelector(data) {
    const { selector } = data;
    
    try {
      const element = document.querySelector(selector);
      if (!element) {
        console.warn('[Lovivo Visual Edit] Cannot highlight: element not found', selector);
        return;
      }

      highlightElement(element, selector);
    } catch (error) {
      console.error('[Lovivo Visual Edit] Error highlighting by selector:', error);
    }
  }

  // ===== PHASE 6: MODE ACTIVATION & DEACTIVATION =====

  /**
   * Activate Visual Edit Mode
   */
  function activateVisualEditMode() {
    if (state.eventListenersAttached) {
      console.log('[Lovivo Visual Edit] Already active');
      return;
    }

    state.isActive = true;

    // Prevent all interactions with capture phase
    const eventsToBlock = [
      'click',
      'mousedown',
      'mouseup',
      'dblclick',
      'contextmenu',
      'submit',
      'dragstart',
      'touchstart',
      'touchmove',
      'touchend'
    ];

    eventsToBlock.forEach(eventType => {
      document.addEventListener(eventType, preventDefaultBehavior, {
        capture: true,
        passive: false
      });
    });

    // Change cursor and prevent selection
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';
    document.body.classList.add('lovivo-visual-edit-active');

    state.eventListenersAttached = true;
    
    console.log('🎨 Lovivo Visual Edit Mode ACTIVATED');
    sendMessage(MESSAGE_TYPES.READY, { active: true });
  }

  /**
   * Deactivate Visual Edit Mode and cleanup
   */
  function deactivateVisualEditMode() {
    if (!state.eventListenersAttached) {
      return;
    }

    state.isActive = false;

    // Remove event listeners
    const eventsToBlock = [
      'click',
      'mousedown',
      'mouseup',
      'dblclick',
      'contextmenu',
      'submit',
      'dragstart',
      'touchstart',
      'touchmove',
      'touchend'
    ];

    eventsToBlock.forEach(eventType => {
      document.removeEventListener(eventType, preventDefaultBehavior, true);
    });

    // Restore cursor and selection
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.classList.remove('lovivo-visual-edit-active');

    // Clear all highlights and selections
    clearHighlight();
    clearSelection();

    // Cancel any pending RAF
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }

    state.eventListenersAttached = false;
    
    console.log('🎨 Lovivo Visual Edit Mode DEACTIVATED');
  }

  /**
   * Cleanup all resources
   */
  function cleanup() {
    // Remove overlays
    if (state.overlays.hover && state.overlays.hover.parentNode) {
      state.overlays.hover.parentNode.removeChild(state.overlays.hover);
    }
    if (state.overlays.selected && state.overlays.selected.parentNode) {
      state.overlays.selected.parentNode.removeChild(state.overlays.selected);
    }
    if (state.overlays.tooltip && state.overlays.tooltip.parentNode) {
      state.overlays.tooltip.parentNode.removeChild(state.overlays.tooltip);
    }

    // Clear cache
    state.selectorCache = new WeakMap();
    
    // Reset state
    state.currentHighlightedElement = null;
    state.currentSelectedElement = null;
  }

  // ===== PHASE 7: MESSAGE LISTENER & INITIALIZATION =====

  /**
   * Validate message origin for security
   * @param {MessageEvent} event - The message event
   * @returns {boolean} Whether the message origin is valid
   */
  function isValidMessageOrigin(event) {
    // If no allowed origins configured, allow parent window only
    if (state.config.allowedOrigins.length === 0) {
      // In iframe, parent window is typically trusted
      if (window.parent === event.source) {
        return true;
      }
      
      // If strict checking is disabled, allow same origin
      if (!state.config.strictOriginCheck && event.origin === window.location.origin) {
        return true;
      }
      
      // Log warning if strict mode
      if (state.config.strictOriginCheck) {
        console.warn('[Lovivo Visual Edit] Message from non-parent origin:', event.origin);
        return false;
      }
      
      return true;
    }
    
    // Check against allowed origins list
    const isAllowed = state.config.allowedOrigins.some(allowedOrigin => {
      // Support wildcard matching
      if (allowedOrigin === '*') {
        return true;
      }
      
      // Exact match
      if (event.origin === allowedOrigin) {
        return true;
      }
      
      // Pattern matching (e.g., "*.lovivo.com")
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(event.origin);
      }
      
      return false;
    });
    
    if (!isAllowed) {
      console.warn('[Lovivo Visual Edit] Message from unauthorized origin:', event.origin);
      if (state.config.enableDebug) {
        console.log('[Lovivo Visual Edit] Allowed origins:', state.config.allowedOrigins);
      }
    }
    
    return isAllowed;
  }

  /**
   * Configure allowed origins for message validation
   * @param {Array<string>} origins - Array of allowed origins (supports wildcards)
   * @param {boolean} strict - Whether to enforce strict validation
   */
  function setAllowedOrigins(origins, strict = false) {
    if (Array.isArray(origins)) {
      state.config.allowedOrigins = origins;
      state.config.strictOriginCheck = strict;
      console.log('[Lovivo Visual Edit] Allowed origins configured:', origins);
    }
  }

  /**
   * Configure visual edit bridge settings
   * @param {Object} options - Configuration options
   *   - parentOrigin: Target origin for outgoing messages
   *   - allowedOrigins: Array of allowed origins for incoming messages
   *   - strictOriginCheck: Whether to enforce strict validation
   *   - autoDetectParent: Whether to auto-detect parent origin
   *   - enableDebug: Enable debug logging
   */
  function configure(options = {}) {
    if (typeof options !== 'object') {
      console.error('[Lovivo Visual Edit] Configure expects an object');
      return;
    }

    // Update parent origin for outgoing messages
    if (options.parentOrigin !== undefined) {
      if (typeof options.parentOrigin === 'string' || options.parentOrigin === null) {
        state.config.parentOrigin = options.parentOrigin;
        console.log('[Lovivo Visual Edit] Parent origin set to:', options.parentOrigin);
      }
    }

    // Update allowed origins for incoming messages
    if (options.allowedOrigins !== undefined) {
      if (Array.isArray(options.allowedOrigins)) {
        state.config.allowedOrigins = options.allowedOrigins;
        console.log('[Lovivo Visual Edit] Allowed origins set to:', options.allowedOrigins);
      }
    }

    // Update strict origin check
    if (options.strictOriginCheck !== undefined) {
      state.config.strictOriginCheck = Boolean(options.strictOriginCheck);
    }

    // Update auto-detect parent
    if (options.autoDetectParent !== undefined) {
      state.config.autoDetectParent = Boolean(options.autoDetectParent);
    }

    // Update debug mode
    if (options.enableDebug !== undefined) {
      state.config.enableDebug = Boolean(options.enableDebug);
    }

    if (state.config.enableDebug) {
      console.log('[Lovivo Visual Edit] Configuration updated:', state.config);
    }
  }

  /**
   * Main message handler with origin validation
   */
  window.addEventListener('message', (event) => {
    // Validate message structure
    if (!event.data || typeof event.data !== 'object') {
      return;
    }

    const { type, ...data } = event.data;

    // Only process our message types
    if (!type || typeof type !== 'string') {
      return;
    }

    // SECURITY: Validate message origin
    if (!isValidMessageOrigin(event)) {
      return;
    }

    try {
      switch (type) {
        case MESSAGE_TYPES.ACTIVATE:
          activateVisualEditMode();
          break;

        case MESSAGE_TYPES.DEACTIVATE:
          deactivateVisualEditMode();
          break;

        case MESSAGE_TYPES.DETECT:
          handleDetectElement(data);
          break;

        case MESSAGE_TYPES.HIGHLIGHT:
          if (data.selector) {
            handleHighlightBySelector(data);
          }
          break;

        case MESSAGE_TYPES.CLEAR_HIGHLIGHT:
          clearHighlight();
          break;

        case MESSAGE_TYPES.REQUEST_INFO:
          handleRequestInfo(data);
          break;

        // Special configuration message
        case 'VISUAL_EDIT_CONFIGURE':
          configure(data);
          break;

        default:
          // Ignore unknown message types
          break;
      }
    } catch (error) {
      console.error('[Lovivo Visual Edit] Error handling message:', error);
      sendMessage(MESSAGE_TYPES.ERROR, {
        error: error.message,
        messageType: type
      });
    }
  });

  // ===== INITIALIZATION =====

  // Send ready message to parent
  sendMessage(MESSAGE_TYPES.READY, { 
    version: '2.0.0',
    features: [
      'optimal-selectors',
      'tailwind-filtering',
      'data-attributes',
      'precise-detection',
      'professional-overlays',
      'performance-optimized',
      'origin-validation'
    ]
  });

  console.log('✅ Lovivo Visual Edit Bridge initialized and ready');
  
  // Auto-detect parent origin on initialization
  if (state.config.autoDetectParent && !state.config.parentOrigin) {
    const detected = detectParentOrigin();
    if (detected) {
      state.config.parentOrigin = detected;
      console.log('[Lovivo Visual Edit] Auto-detected parent origin:', detected);
    }
  }
  
  // Expose configuration functions globally for easy setup
  if (typeof window !== 'undefined') {
    window.lovivoVisualEdit = {
      configure,
      setAllowedOrigins,
      getConfig: () => ({ ...state.config }), // Read-only config
      version: '2.0.0'
    };
  }

  // ===== AUTO-CONFIGURATION FOR LOVIVO/LOVABLE =====
  
  /**
   * Auto-configure security settings for Lovivo and Lovable domains
   * This runs automatically and configures wildcards for:
   * - Lovable.app (editor and previews)
   * - Lovivo.app (all subdomains)
   */
  (function autoConfigureLovivo() {
    // Detect if we're in development (localhost) or testing (lovableproject.com)
    const hostname = window.location.hostname;
    const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1';
    const isTesting = hostname.includes('lovableproject.com') || hostname.includes('lovable.app');

    // Configure allowed origins with wildcards
    configure({
      // ALLOWED ORIGINS (Incoming messages)
      allowedOrigins: [
        // Lovable.app - Editor and previews
        'https://*.lovable.app',
        'https://lovable.app',
        
        // Lovableproject.com - Preview URLs
        'https://*.lovableproject.com',
        'https://lovableproject.com',
        
        // Lovivo.app - Production and subdomains
        'https://*.lovivo.app',
        'https://lovivo.app',
        
        // Localhost for development
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      ],

      // Security settings
      strictOriginCheck: false,    // Allow parent window by default
      autoDetectParent: true,      // Auto-detect parent origin for outgoing messages

      // Enable debug in development AND testing environments
      enableDebug: isDevelopment || isTesting
    });

    console.log('🔒 Lovivo security configured');
    console.log('📋 Allowed origins:', [
      '*.lovable.app',
      '*.lovableproject.com',
      '*.lovivo.app',
      'localhost (dev)'
    ]);
    
    if (isDevelopment) {
      console.log('🐛 Debug mode: ENABLED (localhost detected)');
    } else if (isTesting) {
      console.log('🐛 Debug mode: ENABLED (testing environment detected)');
      console.log('💡 Check console for detailed element detection logs');
    }
  })();

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    deactivateVisualEditMode();
    cleanup();
  });

})();
