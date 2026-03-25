// Add a subtle parallax effect to background circles
document.addEventListener('mousemove', (e) => {
    const circles = document.querySelectorAll('.circle');
    const mouseX = e.clientX / window.innerWidth;
    const mouseY = e.clientY / window.innerHeight;
    
    circles.forEach((circle, index) => {
        const speed = (index + 1) * 20;
        const x = (mouseX - 0.5) * speed;
        const y = (mouseY - 0.5) * speed;
        
        circle.style.transform = `translate(${x}px, ${y}px)`;
    });
});

// Console easter egg
console.log('%c🚀 Kreativ Platform', 'font-size: 24px; font-weight: bold; background: linear-gradient(135deg, #007AFF 0%, #B9E5FB 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;');
console.log('%cEm breve, agentes inteligentes ao seu alcance!', 'font-size: 14px; color: #007AFF;');
