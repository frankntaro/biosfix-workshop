/** Browser-specific steps when native install prompt is unavailable */
export function getInstallGuide() {
  if (typeof navigator === "undefined") {
    return { id: "generic", title: "Your browser", steps: ["Use the browser menu to install or add to home screen."] };
  }

  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isEdg = /edg/i.test(ua);
  const isFirefox = /firefox/i.test(ua);
  const isCriOS = /crios/i.test(ua);
  const isFxiOS = /fxios/i.test(ua);
  const isChrome = /chrome/i.test(ua) && !isEdg;
  const isSafari =
    /safari/i.test(ua) && !isChrome && !isCriOS && !isFxiOS && !isEdg && !isFirefox;

  if (isIOS) {
    return {
      id: "ios",
      title: "iPhone or iPad",
      steps: [
        "Tap the Share button (square with arrow up).",
        "Scroll the menu and tap Add to Home Screen.",
        "Tap Add — the BIOSFIX icon appears on your home screen.",
      ],
      note: "Works in Safari, Chrome, and Edge on iOS. Private tabs may hide Add to Home Screen.",
    };
  }

  if (isAndroid) {
    return {
      id: "android",
      title: "Android phone or tablet",
      steps: [
        "Tap the menu ⋮ (top right) in Chrome, Edge, or Samsung Internet.",
        "Tap Install app or Add to Home screen.",
        "Confirm — open BIOSFIX from your home screen.",
      ],
      note: "If you see Install app in the chip above, tap it first for one-step install.",
    };
  }

  if (isEdg) {
    return {
      id: "edge",
      title: "Microsoft Edge",
      steps: [
        "Click the app install icon in the address bar, or",
        "Menu ⋯ → Apps → Install this site as an app.",
        "Click Install and launch from your apps list.",
      ],
    };
  }

  if (isChrome) {
    return {
      id: "chrome",
      title: "Google Chrome",
      steps: [
        "Click Install in the address bar (monitor ⊕ icon), or",
        "Menu ⋮ → Install BIOSFIX… or Save and share → Install.",
        "Click Install.",
      ],
      note: "Install is not offered in Incognito/private windows — use a normal window.",
    };
  }

  if (isFirefox) {
    return {
      id: "firefox",
      title: "Mozilla Firefox",
      steps: [
        "Open the application menu ☰.",
        "Click Install… or Install this site (wording varies).",
        "Confirm to add BIOSFIX to your device.",
      ],
    };
  }

  if (isSafari) {
    return {
      id: "safari-mac",
      title: "Safari (Mac)",
      steps: [
        "Menu File → Add to Dock, or",
        "Share → Add to Home Screen.",
        "Open BIOSFIX from the Dock or Home Screen.",
      ],
    };
  }

  return {
    id: "generic",
    title: "Your browser",
    steps: [
      "Open the browser menu.",
      "Look for Install app, Add to Home Screen, or Add to Dock.",
      "Follow the prompts to add BIOSFIX.",
    ],
  };
}

export function serviceWorkerSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}
