// ===== LOVIVO VISUAL EDIT BRIDGE =====
// This script enables visual editing mode communication between Lovivo editor and store preview

(function () {
  console.log("🎨 Visual Edit Bridge initialized");

  // State management
  let isVisualEditActive = false;
  let eventListenersAttached = false;
  let highlightOverlay = null;
  let currentHighlightedElement = null;

  // ===== UTILITY FUNCTIONS =====

  /**
   * Generate a unique CSS selector for an element
   * Uses CSS.escape() to handle special characters from Tailwind classes
   */
  function generateSelector(element) {
    if (!element || element === document.documentElement) {
      return null;
    }

    // Try ID first
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    // Build path using tag + limited classes
    const path = [];
    let current = element;

    while (current && current !== document.body && path.length < 10) {
      let selector = current.tagName.toLowerCase();

      // Add up to 2 classes (escaped)
      if (current.className && typeof current.className === "string") {
        const classes = current.className
          .trim()
          .split(/\s+/)
          .filter((c) => c);
        if (classes.length > 0) {
          const escapedClasses = classes
            .slice(0, 2)
            .map((c) => CSS.escape(c))
            .join(".");
          selector += "." + escapedClasses;
        }
      }

      // Add nth-child for uniqueness
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children);
        const index = siblings.indexOf(current) + 1;
        if (siblings.length > 1) {
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    const fullSelector = path.join(" > ");

    // Validate selector before returning
    try {
      document.querySelector(fullSelector);
      return fullSelector;
    } catch (e) {
      console.error("[VisualEdit Bridge] Invalid selector generated:", fullSelector, e);
      return null;
    }
  }

  /**
   * Create or get the highlight overlay element
   */
  function createHighlightOverlay() {
    if (highlightOverlay) return highlightOverlay;

    highlightOverlay = document.createElement("div");
    highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.15);
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.1);
      z-index: 2147483647;
      transition: all 0.1s ease;
      display: none;
    `;
    document.body.appendChild(highlightOverlay);
    return highlightOverlay;
  }

  /**
   * Update highlight overlay position based on element's current position
   */
  function updateHighlightPosition() {
    if (!currentHighlightedElement || !highlightOverlay) return;

    const rect = currentHighlightedElement.getBoundingClientRect();
    highlightOverlay.style.top = `${rect.top}px`;
    highlightOverlay.style.left = `${rect.left}px`;
    highlightOverlay.style.width = `${rect.width}px`;
    highlightOverlay.style.height = `${rect.height}px`;
    highlightOverlay.style.display = "block";
  }

  /**
   * Highlight an element by its selector
   */
  function highlightElement(selector) {
    try {
      const element = document.querySelector(selector);
      if (!element) {
        console.warn("[VisualEdit Bridge] Cannot highlight: element not found", selector);
        return;
      }

      currentHighlightedElement = element;
      const overlay = createHighlightOverlay();

      // Update position
      updateHighlightPosition();

      // Setup scroll handler
      if (!window._visualEditScrollHandler) {
        let scrollTimeout;
        window._visualEditScrollHandler = () => {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(updateHighlightPosition, 10);
        };
        window.addEventListener("scroll", window._visualEditScrollHandler, true);
      }
    } catch (error) {
      console.error("[VisualEdit Bridge] Error highlighting element:", error);
    }
  }

  /**
   * Clear the highlight overlay
   */
  function clearHighlight() {
    if (highlightOverlay) {
      highlightOverlay.style.display = "none";
    }

    currentHighlightedElement = null;

    // Remove scroll handler
    if (window._visualEditScrollHandler) {
      window.removeEventListener("scroll", window._visualEditScrollHandler, true);
      window._visualEditScrollHandler = null;
    }
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
      textContent: element.textContent?.substring(0, 100) || "",
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

  // ===== EVENT PREVENTION =====

  /**
   * Prevent default behavior when Visual Edit is active
   */
  function preventDefaultBehavior(event) {
    if (isVisualEditActive) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  /**
   * Activate Visual Edit Mode
   */
  function activateVisualEditMode() {
    if (eventListenersAttached) return;

    isVisualEditActive = true;

    // Prevent all interactions
    document.addEventListener("click", preventDefaultBehavior, true);
    document.addEventListener("mousedown", preventDefaultBehavior, true);
    document.addEventListener("mouseup", preventDefaultBehavior, true);
    document.addEventListener("submit", preventDefaultBehavior, true);
    document.addEventListener("dragstart", preventDefaultBehavior, true);

    // Change cursor
    document.body.style.cursor = "crosshair";
    document.body.style.userSelect = "none";

    eventListenersAttached = true;
    console.log("🎨 Visual Edit Mode ACTIVATED - All interactions blocked");
  }

  /**
   * Deactivate Visual Edit Mode
   */
  function deactivateVisualEditMode() {
    if (!eventListenersAttached) return;

    isVisualEditActive = false;

    // Remove event listeners
    document.removeEventListener("click", preventDefaultBehavior, true);
    document.removeEventListener("mousedown", preventDefaultBehavior, true);
    document.removeEventListener("mouseup", preventDefaultBehavior, true);
    document.removeEventListener("submit", preventDefaultBehavior, true);
    document.removeEventListener("dragstart", preventDefaultBehavior, true);

    // Restore cursor
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    eventListenersAttached = false;
    console.log("🎨 Visual Edit Mode DEACTIVATED - Interactions restored");
  }

  // ===== MESSAGE HANDLERS =====

  /**
   * Handle element detection at coordinates
   */
  function handleDetectElement(data) {
    const { x, y, action } = data;
    console.log("[VisualEdit Bridge] Detecting element at", x, y, "action:", action);

    const element = document.elementFromPoint(x, y);

    if (!element || element === document.documentElement || element === document.body) {
      window.parent.postMessage(
        {
          type: "NO_ELEMENT_DETECTED",
          action,
        },
        "*",
      );
      return;
    }

    const selector = generateSelector(element);

    if (!selector) {
      window.parent.postMessage(
        {
          type: "NO_ELEMENT_DETECTED",
          action,
        },
        "*",
      );
      return;
    }

    console.log("[VisualEdit Bridge] Generated selector:", selector);

    if (action === "hover") {
      highlightElement(selector);
      window.parent.postMessage(
        {
          type: "ELEMENT_HOVERED",
          selector,
        },
        "*",
      );
    } else if (action === "click") {
      window.parent.postMessage(
        {
          type: "ELEMENT_CLICKED",
          selector,
        },
        "*",
      );
    }
  }

  /**
   * Handle element info request
   */
  function handleRequestInfo(data) {
    const { selector } = data;

    try {
      const element = document.querySelector(selector);
      if (!element) {
        console.warn("[VisualEdit Bridge] Element not found for info request:", selector);
        return;
      }

      const info = getElementInfo(element);

      window.parent.postMessage(
        {
          type: "ELEMENT_INFO",
          selector,
          ...info,
        },
        "*",
      );
    } catch (error) {
      console.error("[VisualEdit Bridge] Error getting element info:", error);
    }
  }

  // ===== MESSAGE LISTENER =====

  window.addEventListener("message", (event) => {
    const { type, ...data } = event.data;

    switch (type) {
      case "VISUAL_EDIT_MODE_ACTIVATE":
        activateVisualEditMode();
        break;

      case "VISUAL_EDIT_MODE_DEACTIVATE":
        deactivateVisualEditMode();
        clearHighlight();
        break;

      case "VISUAL_EDIT_DETECT_ELEMENT":
        handleDetectElement(data);
        break;

      case "VISUAL_EDIT_HIGHLIGHT":
        if (data.selector) {
          highlightElement(data.selector);
        }
        break;

      case "VISUAL_EDIT_CLEAR_HIGHLIGHT":
        clearHighlight();
        break;

      case "VISUAL_EDIT_REQUEST_INFO":
        handleRequestInfo(data);
        break;
    }
  });
})();
