// Runs before the login document paints. The validated session decides its destination.
document.documentElement.style.visibility = 'hidden';
addEventListener('DOMContentLoaded', () => {
  const indicator = setTimeout(() => {
    if (!document.documentElement.style.visibility) return;
    const status = document.createElement('p');
    status.id = 'session-check-status';
    status.setAttribute('role', 'status');
    status.textContent = 'Verificando sua sessão…';
    Object.assign(status.style, { visibility: 'visible', position: 'fixed', right: '20px', bottom: '16px', color: 'white', fontSize: '14px' });
    document.body.append(status);
  }, 300);
  addEventListener('sessionchecked', () => {
    clearTimeout(indicator);
    document.querySelector('#session-check-status')?.remove();
  }, { once: true });
});
