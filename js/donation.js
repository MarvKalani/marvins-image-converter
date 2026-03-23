/**
 * donation.js - Donation banner logic
 * Part of Marvin's Image Converter modular architecture
 */

// ============================================
// DONATION BANNER
// ============================================

/**
 * Initialize the donation banner
 * Shows on Sundays unless already dismissed today
 */
export function initDonationBanner() {
    const banner = document.getElementById('donation-banner');
    const closeBtn = document.getElementById('donation-close');
    const laterBtn = document.getElementById('donation-later');
    const testBtn = document.getElementById('test-donation-btn');

    if (!banner) return;

    const showBanner = () => {
        banner.style.display = 'block';
    };

    const hideBanner = () => {
        banner.style.display = 'none';
        // Remember that user dismissed it today
        localStorage.setItem('donationBannerDismissedDate', new Date().toDateString());
    };

    // Check if it's Sunday (0 = Sunday in JavaScript)
    const isSunday = () => {
        return new Date().getDay() === 0;
    };

    // Check if user already dismissed the banner today
    const wasDismissedToday = () => {
        const dismissedDate = localStorage.getItem('donationBannerDismissedDate');
        return dismissedDate === new Date().toDateString();
    };

    // Show banner if it's Sunday and not already dismissed today
    if (isSunday() && !wasDismissedToday()) {
        // Small delay to let the page load first
        setTimeout(showBanner, 2000);
    }

    // Close and Later buttons
    if (closeBtn) {
        closeBtn.onclick = hideBanner;
    }
    if (laterBtn) {
        laterBtn.onclick = hideBanner;
    }

    // Test button (for development/testing)
    if (testBtn) {
        testBtn.onclick = () => {
            showBanner();
            console.log('🧪 Test: Donation banner shown manually');
        };
    }

    // Allow closing with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && banner.style.display === 'block') {
            hideBanner();
        }
    });
}
