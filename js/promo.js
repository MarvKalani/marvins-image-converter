
/**
 * promo.js - Self-promotion module
 * Displays internal ads for other Marvin's projects
 */

import { getTranslation } from './i18n.js';

// Ad Definition
const ADS = [
    {
        id: 'list',
        url: 'https://list.marvins.app',
        image: 'img/ad_list.webp',
        titleKey: 'adListTitle',
        textKey: 'adListText',
        color: '#ff9f43' // Orange
    },
    {
        id: 'connector',
        url: 'https://peer2.download',
        image: 'img/ad_connector.webp',
        titleKey: 'adConnectorTitle',
        textKey: 'adConnectorText',
        color: '#0abde3' // Cyan
    },
    {
        id: 'pdf',
        url: 'https://pdf2.download',
        image: 'img/ad_pdf.webp',
        titleKey: 'adPdfTitle',
        textKey: 'adPdfText',
        color: '#ee5253' // Red
    }
];

// Configuration
const AD_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const SHOW_DELAY_MS = 500; // Delay before showing ad after trigger

/**
 * Initialize promo module
 */
export function initPromo() {
    // Preload styles if needed, or simply ensure they are in app.css
    console.log('📢 Promo module initialized');
}

/**
 * Trigger an ad display
 * @param {string} triggerSource - 'batch' or 'save'
 */
export function showAd(triggerSource) {

    // Pick a random ad
    const ad = ADS[Math.floor(Math.random() * ADS.length)];

    setTimeout(() => {
        renderModal(ad);
    }, SHOW_DELAY_MS);
}

/**
 * Close the modal
 */
function closeModal() {
    const modal = document.getElementById('promo-modal-overlay');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300); // Remove after animation
    }
}

/**
 * Render the ad modal
 * @param {object} ad - Ad object
 */
function renderModal(ad) {
    // Remove existing if any
    const existing = document.getElementById('promo-modal-overlay');
    if (existing) existing.remove();

    // Create DOM
    const overlay = document.createElement('div');
    overlay.id = 'promo-modal-overlay';
    overlay.className = 'promo-overlay';

    const modal = document.createElement('div');
    modal.className = 'promo-modal luminant-glass';
    modal.style.borderColor = ad.color + '40'; // Low opacity border

    // Header
    const header = document.createElement('div');
    header.className = 'promo-header promo-banner-header';
    header.style.padding = '0';
    header.style.overflow = 'hidden';
    header.style.borderBottom = `1px solid ${ad.color}40`;

    header.innerHTML = `
        <a href="${ad.url}" target="_blank" class="promo-banner-hover" style="display: block; width: 100%; text-decoration: none;">
            <div class="promo-banner-img" style="width: 100%; height: 160px; background-color: #1a1a2e; background-image: linear-gradient(135deg, ${ad.color}40 0%, #1a1a2e 100%), url('${ad.image}'); background-blend-mode: overlay; background-size: cover; background-position: center; border-radius: 14px 14px 0 0; position: relative; transition: all 0.3s ease;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.95), transparent); padding: 30px 15px 10px;">
                    <h3 style="margin: 0; color: white; display: flex; align-items: center; gap: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
                        ${getTranslation(ad.titleKey)}
                        <span class="promo-badge" style="background: ${ad.color}; margin-left: auto; box-shadow: 0 0 10px ${ad.color}80;">${getTranslation('adBadge') || 'Empfehlung'}</span>
                    </h3>
                </div>
            </div>
        </a>
    `;

    // Body
    const body = document.createElement('div');
    body.className = 'promo-body';
    body.innerHTML = `<p>${getTranslation(ad.textKey)}</p>`;

    // Footer
    const footer = document.createElement('div');
    footer.className = 'promo-footer';

    // Buttons
    const visitBtn = document.createElement('a');
    visitBtn.href = ad.url;
    visitBtn.target = '_blank';
    visitBtn.className = 'promo-btn-primary';
    visitBtn.style.backgroundColor = ad.color;
    visitBtn.textContent = getTranslation('adVisitBtn') || 'Kostenlos testen';
    visitBtn.onclick = () => closeModal();

    const closeBtn = document.createElement('button');
    closeBtn.className = 'promo-btn-secondary';
    closeBtn.textContent = getTranslation('adCloseBtn') || 'Schließen';
    closeBtn.onclick = closeModal;

    // The Placeholder Hint
    const adHint = document.createElement('div');
    adHint.style.width = '100%';
    adHint.style.textAlign = 'center';
    adHint.style.marginTop = '12px';
    adHint.style.fontSize = '11px';
    adHint.style.color = 'rgba(255,255,255,0.4)';
    adHint.style.fontWeight = '300';
    adHint.style.letterSpacing = '0.5px';
    adHint.style.cursor = 'pointer';
    adHint.textContent = getTranslation('adPlaceholder') || 'Hier könnte Ihre Anzeige stehen';
    adHint.onclick = () => {
        window.open('mailto:kontakt@marvins.app?subject=Werbeanfrage%20Bildwandler');
    };

    footer.appendChild(visitBtn);
    footer.appendChild(closeBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    modal.appendChild(adHint);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(() => overlay.classList.add('active'));
}
