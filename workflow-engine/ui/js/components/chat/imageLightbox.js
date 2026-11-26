// imageLightbox - full-viewport view of one chat image.
// Plain DOM on <body> so no ancestor's transform or overflow can clip it.

let closeActive = null;

/**
 * Close the open lightbox, if any. Returns true when it consumed the request,
 * so the mobile back handler can stop there instead of also closing a drawer.
 */
export function consumeOverlayBack() {
  if (!closeActive) return false;
  closeActive();
  return true;
}

export function openImageLightbox(src, alt) {
  if (closeActive) closeActive();

  const previousFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'chat-image-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', alt || 'Image');
  overlay.tabIndex = -1;

  const image = document.createElement('img');
  image.className = 'chat-image-lightbox-image';
  image.src = src;
  image.alt = alt || '';
  overlay.appendChild(image);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };

  function close() {
    if (closeActive !== close) return;
    closeActive = null;
    document.removeEventListener('keydown', onKeyDown, true);
    overlay.remove();
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus({ preventScroll: true });
    }
  }

  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown, true);
  document.body.appendChild(overlay);
  overlay.focus({ preventScroll: true });
  closeActive = close;
}
