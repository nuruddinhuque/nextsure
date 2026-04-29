 // FAQ Accordion Functionality
    document.addEventListener('DOMContentLoaded', function() {
      const faqItems = document.querySelectorAll('.faq-item');
      
      faqItems.forEach(function(item) {
        const header = item.querySelector('.faq-header');
        
        header.addEventListener('click', function() {
          const isActive = item.classList.contains('active');
          
          // Close all FAQ items
          faqItems.forEach(function(faqItem) {
            faqItem.classList.remove('active');
          });
          
          // Open clicked item if it wasn't already active
          if (!isActive) {
            item.classList.add('active');
          }
        });
      });
    });