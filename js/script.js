// This script handles general site interaction and can be expanded for advanced features.

document.addEventListener('DOMContentLoaded', function() {
    console.log("Website loaded successfully. JavaScript is active.");

    // 1. Smooth Scrolling for Navigation Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // 2. Simple Contact Form Handling (Preventing default submission)
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // In a real application, you would send this data to a backend API here.
            alert('Thank you for your message! We will get back to you shortly.');
            contactForm.reset();
        });
    }
});