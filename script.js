// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Header scroll effect
let lastScroll = 0;
const header = document.querySelector('.header');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        header.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1)';
    } else {
        header.style.boxShadow = 'none';
    }

    lastScroll = currentScroll;
});

// Waitlist form handling
const waitlistForm = document.getElementById('waitlistForm');
const successMessage = document.getElementById('successMessage');

waitlistForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get form data
    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        stage: document.getElementById('stage').value,
        timestamp: new Date().toISOString()
    };

    // Simulate API call
    // In production, replace this with your actual API endpoint
    try {
        // Show loading state
        const submitButton = waitlistForm.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = 'Cadastrando...';
        submitButton.disabled = true;

        // Simulate delay (remove this in production)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Store in localStorage for demo purposes
        // In production, send to your backend
        const existingLeads = JSON.parse(localStorage.getItem('startproof_leads') || '[]');
        existingLeads.push(formData);
        localStorage.setItem('startproof_leads', JSON.stringify(existingLeads));

        console.log('New lead captured:', formData);

        // Show success message
        waitlistForm.style.display = 'none';
        successMessage.classList.add('show');

        // Track conversion (integrate with your analytics)
        if (typeof gtag !== 'undefined') {
            gtag('event', 'conversion', {
                'send_to': 'YOUR_CONVERSION_ID',
                'value': 1.0,
                'currency': 'BRL'
            });
        }

        // Optional: Send to Google Sheets, Mailchimp, etc.
        // await sendToGoogleSheets(formData);
        // await sendToMailchimp(formData);

    } catch (error) {
        console.error('Error submitting form:', error);
        alert('Ocorreu um erro ao cadastrar. Por favor, tente novamente.');

        // Reset button
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
});

// Animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.step, .feature-card, .problem-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(el);
});

// Stats counter animation
const animateCounter = (element, target) => {
    let current = 0;
    const increment = target / 50;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 30);
};

// Track page views
if (typeof gtag !== 'undefined') {
    gtag('event', 'page_view', {
        page_title: 'StartProof Landing Page',
        page_location: window.location.href,
        page_path: window.location.pathname
    });
}

// Track button clicks
document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('click', function() {
        const buttonText = this.textContent.trim();
        if (typeof gtag !== 'undefined') {
            gtag('event', 'click', {
                event_category: 'Button',
                event_label: buttonText,
                value: 1
            });
        }
        console.log('Button clicked:', buttonText);
    });
});

// Easter egg: Console message for curious developers
console.log('%c👋 Olá, desenvolvedor curioso!', 'font-size: 20px; font-weight: bold; color: #6366f1;');
console.log('%cSe você está interessado em validar sua ideia de SaaS, entre na nossa lista de espera!', 'font-size: 14px; color: #64748b;');
console.log('%c🚀 StartProof - Transforme sua ideia em negócio real', 'font-size: 16px; font-weight: bold; color: #10b981;');
