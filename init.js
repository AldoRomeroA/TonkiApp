/* TONKIAPP - Scripts de Interfaz
   Desarrollado por Zumatek (Zumayinsky)
*/

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 TonkiApp Engine Started...');

    // 1. Animación de Números (Count Up)
    const counters = document.querySelectorAll('h3'); // Selecciona los números en las cards
    const speed = 200; // Velocidad de animación

    counters.forEach(counter => {
        const animate = () => {
            const value = +counter.innerText;
            // Solo animar si el contenido es un número
            if (!isNaN(value)) {
                const data = +counter.getAttribute('data-target') || value;
                const time = data / speed;
                if (value < data) {
                    counter.innerText = Math.ceil(value + time);
                    setTimeout(animate, 1);
                } else {
                    counter.innerText = data;
                }
            }
        }
        // Guardamos el valor original y empezamos en 0 para el efecto
        if (!isNaN(+counter.innerText)) {
            counter.setAttribute('data-target', counter.innerText);
            counter.innerText = '0';
            animate();
        }
    });

    // 2. Efecto de Hover en las Cards (Sutil)
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = 'var(--accent-gold)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.borderColor = 'var(--border-color)';
        });
    });

    // 3. Confirmación para salir (Opcional, pero da seguridad)
    const logoutBtn = document.querySelector('a[href="/"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            if (!confirm('¿Seguro que quieres cerrar sesión en TonkiApp?')) {
                e.preventDefault();
            }
        });
    }
});