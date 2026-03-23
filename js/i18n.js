/**
 * i18n.js - Internationalization and translation functions
 * Part of Marvin's Image Converter modular architecture
 */

// ============================================
// STATE
// ============================================

// Import translations from external file (loaded via script tag)
// translations.js defines a global `translations` object
const getTranslations = () => window.translations || {};

// Current language - loaded from localStorage or detected
let currentLanguage = localStorage.getItem('selectedLanguage') || 'de';

// ============================================
// LANGUAGE DETECTION
// ============================================

/**
 * Detect browser language with fallback to German
 * @returns {string} Language code
 */
export function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage || 'de';
    const langCode = browserLang.split('-')[0].toLowerCase();

    // Check if we support this language
    const supportedLanguages = ['de', 'en', 'es', 'fr', 'ar', 'zh', 'ja', 'ko', 'ru'];
    return supportedLanguages.includes(langCode) ? langCode : 'de';
}

// ============================================
// TRANSLATION CORE
// ============================================

/**
 * Get current language
 * @returns {string} Current language code
 */
export function getCurrentLanguage() {
    return currentLanguage;
}

/**
 * Set current language and save to localStorage
 * @param {string} lang - Language code
 */
export function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('selectedLanguage', lang);
}

/**
 * Get translation for a key
 * @param {string} key - Translation key
 * @returns {string} Translated string or key as fallback
 */
export function getTranslation(key) {
    const translations = getTranslations();
    return translations[currentLanguage]?.[key] || translations.de?.[key] || key;
}

/**
 * Get flag emoji for a language
 * @param {string} lang - Language code
 * @returns {string} Flag emoji
 */
export function getFlagForLanguage(lang) {
    const flags = {
        de: '🇩🇪',
        en: '🇬🇧',
        es: '🇪🇸',
        fr: '🇫🇷',
        ar: '🇸🇦',
        zh: '🇨🇳',
        ja: '🇯🇵',
        ko: '🇰🇷',
        ru: '🇷🇺',
    };
    return flags[lang] || '🌐';
}

// ============================================
// UI UPDATE
// ============================================

/**
 * Update all translatable elements in the DOM
 */
export function updateLanguage() {
    // Save current language to localStorage
    localStorage.setItem('selectedLanguage', currentLanguage);

    const translations = getTranslations();
    const langData = translations[currentLanguage] || translations.de || {};

    console.log('[i18n] Updating language to:', currentLanguage, 'Keys available:', Object.keys(langData).length);

    // Generic translation for all elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach((element) => {
        const key = element.getAttribute('data-translate');
        const translation = langData[key] || translations.de?.[key];

        if (translation) {
            const useHtml = element.hasAttribute('data-translate-html');
            // For elements with no children, just set text or HTML
            if (element.children.length === 0) {
                if (useHtml) {
                    element.innerHTML = translation;
                } else {
                    element.textContent = translation;
                }
            }
        }
    });

    // SEO Updates
    if (langData.seoTitle) document.title = langData.seoTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && langData.seoDescription) {
        metaDesc.setAttribute('content', langData.seoDescription);
    }

    // Generic translation for title attributes
    document.querySelectorAll('[data-translate-title]').forEach((element) => {
        const key = element.getAttribute('data-translate-title');
        const translation = langData[key] || translations.de?.[key];
        if (translation) {
            element.title = translation;
        }
    });

    // Update theme toggle
    const themeToggleBtn = document.querySelector('#theme-toggle');
    if (themeToggleBtn) themeToggleBtn.title = getTranslation('themeToggle');

    // Update quality label (special handling to preserve value span)
    const qualityLabel = document.querySelector('label[for="quality-slider"]');
    if (qualityLabel) {
        const qualityValue = document.getElementById('quality-value');
        const value = qualityValue ? qualityValue.textContent : '85';
        qualityLabel.innerHTML = `<span data-translate="qualityLabel">${getTranslation('qualityLabel')}</span> <span id="quality-value">${value}</span>%`;
    }

    // Update percent label (special handling to preserve value span)
    const percentLabel = document.querySelector('label[for="percent-slider"]');
    if (percentLabel) {
        const percentValue = document.getElementById('percent-value');
        const value = percentValue ? percentValue.textContent : '100';
        percentLabel.innerHTML = `<span data-translate="resizeLabel">${getTranslation('resizeLabel')}</span> <span id="percent-value">${value}</span>%`;
    }

    // Update budget label (special handling to preserve value span)
    const budgetLabel = document.querySelector('label[for="budget-slider"]');
    if (budgetLabel) {
        const budgetValueSpan = document.getElementById('budget-value');
        const value = budgetValueSpan ? budgetValueSpan.textContent : '9';
        budgetLabel.innerHTML = `<span data-translate="budgetLabel">${getTranslation('budgetLabel')}</span> <span id="budget-value">${value}</span> MB`;
    }

    // Update file count display
    const fileCountDisplay = document.getElementById('file-count-display');
    if (fileCountDisplay) {
        // This will be updated by file-queue.js, just ensure the format is available
    }

    // Update size labels
    const totalOriginalLabel = document.getElementById('total-original-label');
    if (totalOriginalLabel) totalOriginalLabel.textContent = getTranslation('originalSize');

    const totalEstimatedLabel = document.getElementById('total-estimated-label');
    if (totalEstimatedLabel) totalEstimatedLabel.textContent = getTranslation('estimatedSize');

    // Update buttons
    const processButton = document.getElementById('process-button');
    if (processButton) {
        processButton.title = getTranslation('processButton');
    }

    const addFilesBtn = document.getElementById('add-files-btn');
    if (addFilesBtn) addFilesBtn.title = getTranslation('addFiles');

    const resetAllBtn = document.getElementById('reset-all-btn');
    if (resetAllBtn) resetAllBtn.title = getTranslation('resetAll');

    const calculateAllBtn = document.getElementById('calculate-all-btn');
    if (calculateAllBtn) {
        calculateAllBtn.textContent = getTranslation('calculateAll');
    }

    // Update modal buttons titles
    const modalPrevBtn = document.getElementById('modal-prev-btn');
    if (modalPrevBtn) modalPrevBtn.title = getTranslation('prevImage');

    const modalNextBtn = document.getElementById('modal-next-btn');
    if (modalNextBtn) modalNextBtn.title = getTranslation('nextImage');

    const modalCloseBtn = document.getElementById('modal-close-btn');
    if (modalCloseBtn) modalCloseBtn.title = getTranslation('modalCloseTooltip');

    // Update save button
    const saveBtnText = document.getElementById('save-btn-text');
    if (saveBtnText) saveBtnText.textContent = getTranslation('saveImage');

    // Update reset zoom button
    const resetZoomBtn = document.getElementById('reset-zoom-btn');
    if (resetZoomBtn) resetZoomBtn.textContent = getTranslation('resetZoom') || 'Reset';

    // Update A/B comparison labels
    const abLabelPreview = document.getElementById('ab-label-preview');
    if (abLabelPreview) abLabelPreview.textContent = getTranslation('previewImage') || 'Vorschau';

    const abLabelOriginal = document.getElementById('ab-label-original');
    if (abLabelOriginal) abLabelOriginal.textContent = getTranslation('originalImage') || 'Original';

    // Update modal format label
    const modalFormatLabel = document.getElementById('modal-format-label');
    if (modalFormatLabel) modalFormatLabel.textContent = getTranslation('convertAllTo') || 'Format:';

    // Update modal size mode label
    const modalSizeModeLabel = document.getElementById('modal-size-mode-label');
    if (modalSizeModeLabel) {
        const span = modalSizeModeLabel.querySelector('span');
        if (span) span.textContent = getTranslation('sizeMode') || 'Größen-Modus:';
    }

    // Update SVG settings translations
    const svgSettingsHeader = document.getElementById('svg-settings-header');
    if (svgSettingsHeader) svgSettingsHeader.textContent = getTranslation('svgSettings') || 'SVG Settings';

    // SVG settings labels - use data-translate or manual update
    const svgColorPrecisionLabel = document.querySelector('label[for="svg-color-precision"]');
    if (svgColorPrecisionLabel) {
        const valueSpan = svgColorPrecisionLabel.querySelector('span:last-child');
        const value = valueSpan ? valueSpan.textContent : '';
        svgColorPrecisionLabel.innerHTML = `${getTranslation('svgColorPrecision') || 'Color Precision:'} <span id="svg-color-precision-value">${value}</span>`;
    }

    const svgLayerDiffLabel = document.querySelector('label[for="svg-layer-difference"]');
    if (svgLayerDiffLabel) {
        const valueSpan = svgLayerDiffLabel.querySelector('span:last-child');
        const value = valueSpan ? valueSpan.textContent : '';
        svgLayerDiffLabel.innerHTML = `${getTranslation('svgLayerDifference') || 'Gradient Step:'} <span id="svg-layer-difference-value">${value}</span>`;
    }

    const svgCornerLabel = document.querySelector('label[for="svg-corner-threshold"]');
    if (svgCornerLabel) {
        const valueSpan = svgCornerLabel.querySelector('span:last-child');
        const value = valueSpan ? valueSpan.textContent : '';
        svgCornerLabel.innerHTML = `${getTranslation('svgCornerThreshold') || 'Corner Threshold:'} <span id="svg-corner-value">${value}</span>`;
    }

    const svgFilterLabel = document.querySelector('label[for="svg-filter-speckle"]');
    if (svgFilterLabel) {
        const valueSpan = svgFilterLabel.querySelector('span:last-child');
        const value = valueSpan ? valueSpan.textContent : '';
        svgFilterLabel.innerHTML = `${getTranslation('svgFilterSpeckle') || 'Filter Speckle:'} <span id="svg-filter-value">${value}</span>`;
    }

    const svgPathLabel = document.querySelector('label[for="svg-path-precision"]');
    if (svgPathLabel) {
        const valueSpan = svgPathLabel.querySelector('span:last-child');
        const value = valueSpan ? valueSpan.textContent : '';
        svgPathLabel.innerHTML = `${getTranslation('svgPathPrecision') || 'Path Precision:'} <span id="svg-precision-value">${value}</span>`;
    }

    // Splice threshold
    const svgSpliceLabel = document.querySelector('label[for="svg-splice-threshold"]');
    if (svgSpliceLabel) {
        const valueSpan = svgSpliceLabel.querySelector('span:last-child');
        const value = valueSpan ? valueSpan.textContent : '';
        svgSpliceLabel.innerHTML = `${getTranslation('svgSpliceThreshold') || 'Splice Threshold:'} <span id="svg-splice-threshold-value">${value}</span>°`;
    }

    // Segment length
    const svgLengthLabel = document.querySelector('label[for="svg-length-threshold"]');
    if (svgLengthLabel) {
        const valueSpan = svgLengthLabel.querySelector('span:last-child');
        const value = valueSpan ? valueSpan.textContent : '';
        svgLengthLabel.innerHTML = `${getTranslation('svgLengthThreshold') || 'Segment Length:'} <span id="svg-length-threshold-value">${value}</span>`;
    }

    // Max iterations
    const svgMaxIterLabel = document.querySelector('label[for="svg-max-iterations"]');
    if (svgMaxIterLabel) {
        const valueSpan = svgMaxIterLabel.querySelector('span:last-child');
        const value = valueSpan ? valueSpan.textContent : '';
        svgMaxIterLabel.innerHTML = `${getTranslation('svgMaxIterations') || 'Max Iterations:'} <span id="svg-max-iterations-value">${value}</span>`;
    }

    // Hierarchical/Layer mode label
    const svgHierarchicalLabel = document.querySelector('label[for="svg-hierarchical"]');
    if (svgHierarchicalLabel) {
        svgHierarchicalLabel.textContent = getTranslation('svgHierarchical') || 'Layer Mode:';
    }

    // Update A/B split toggle button
    const abSplitToggleBtn = document.getElementById('ab-split-toggle-btn');
    if (abSplitToggleBtn) abSplitToggleBtn.title = getTranslation('toggleSplitOrientation') || 'Split Richtung ändern';

    // Update current flag display
    const currentFlag = document.getElementById('current-flag');
    if (currentFlag) {
        currentFlag.textContent = getFlagForLanguage(currentLanguage);
    }

    // Update document direction for RTL languages
    document.documentElement.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr';

    // Dispatch custom event for other modules that need to update
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: currentLanguage } }));
}

// ============================================
// LANGUAGE SELECTOR
// ============================================

/**
 * Initialize language selector UI
 */
export function initLanguageSelector() {
    const currentFlag = document.getElementById('current-flag');
    const dropdown = document.getElementById('language-dropdown');

    if (!currentFlag || !dropdown) {
        console.warn('[i18n] Language selector elements not found');
        return;
    }

    console.log('[i18n] Initializing language selector');

    // Remove existing listeners by cloning elements
    const newFlag = currentFlag.cloneNode(true);
    currentFlag.parentNode.replaceChild(newFlag, currentFlag);

    // Get the parent language-selector element
    const languageSelector = document.querySelector('.language-selector');

    // Toggle dropdown on flag click
    newFlag.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        console.log('[i18n] Flag clicked, toggling dropdown');
        // Toggle class on parent element as expected by CSS
        languageSelector.classList.toggle('show-dropdown');
    });

    // Handle language selection - use event delegation on dropdown
    dropdown.addEventListener('click', function (e) {
        const option = e.target.closest('.language-option');
        if (option) {
            e.stopPropagation();
            e.preventDefault();
            const lang = option.getAttribute('data-lang');
            console.log('[i18n] Language selected:', lang);
            setLanguage(lang);
            updateLanguage();
            languageSelector.classList.remove('show-dropdown');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.language-selector')) {
            languageSelector.classList.remove('show-dropdown');
        }
    });

    // Set initial flag
    newFlag.textContent = getFlagForLanguage(currentLanguage);
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize i18n system
 * Call this after DOM is ready
 */
export function initI18n() {
    console.log('[i18n] Initializing i18n system');

    // Check if translations are available
    const translations = getTranslations();
    if (!translations || Object.keys(translations).length === 0) {
        console.error('[i18n] Translations not loaded! Make sure translations.js is loaded before main.js');
        return;
    }

    // If no saved language, detect from browser
    if (!localStorage.getItem('selectedLanguage')) {
        currentLanguage = detectBrowserLanguage();
        localStorage.setItem('selectedLanguage', currentLanguage);
    }

    // Initialize language selector UI
    initLanguageSelector();

    // Apply translations
    updateLanguage();

    console.log('[i18n] i18n system initialized with language:', currentLanguage);
}
