/**
 * navigation.js — UnitV Pro PS4
 * Navegação por D-Pad DualShock + teclado
 * Gerencia foco entre elementos .focusable
 */

const Navigation = (() => {
    // PS4 DualShock button mapping (Gamepad API)
    const BTN = {
        CROSS:    0,  // X → Confirmar / Enter
        CIRCLE:   1,  // O → Voltar
        SQUARE:   2,  // □ → Favorito
        TRIANGLE: 3,  // △ → Busca
        L1:       4,
        R1:       5,
        L2:       6,
        R2:       7,
        SELECT:   8,
        START:    9,
        L3:       10,
        R3:       11,
        DPAD_UP:   12,
        DPAD_DOWN: 13,
        DPAD_LEFT: 14,
        DPAD_RIGHT:15,
        PS:       16,
    };

    let _gamepadIndex  = -1;
    let _prevButtons   = {};
    let _rafId         = null;
    let _lastInput     = 0;
    const REPEAT_DELAY = 150; // ms entre repeats de D-Pad

    /* ── Gamepad API ───────────────────────────────────── */
    function startGamepadPolling() {
        window.addEventListener('gamepadconnected', e => {
            _gamepadIndex = e.gamepad.index;
            console.log('[Nav] DualShock conectado:', e.gamepad.id);
            _prevButtons = {};
            _rafId = requestAnimationFrame(pollGamepad);
        });
        window.addEventListener('gamepaddisconnected', e => {
            if (e.gamepad.index === _gamepadIndex) {
                _gamepadIndex = -1;
                if (_rafId) cancelAnimationFrame(_rafId);
            }
        });
        // Some PS4 browsers auto-connect
        const gps = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gps.length; i++) {
            if (gps[i]) { _gamepadIndex = i; _rafId = requestAnimationFrame(pollGamepad); break; }
        }
    }

    function pollGamepad() {
        if (_gamepadIndex < 0) return;
        const gps = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp  = gps[_gamepadIndex];
        if (!gp) { _rafId = requestAnimationFrame(pollGamepad); return; }

        const now = Date.now();
        gp.buttons.forEach((btn, idx) => {
            const wasPressed = _prevButtons[idx] || false;
            const isPressed  = btn.pressed;

            if (isPressed && !wasPressed) {
                // Button just pressed
                _prevButtons[idx] = true;
                handleButton(idx, gp.axes);
                _lastInput = now;
            } else if (!isPressed && wasPressed) {
                _prevButtons[idx] = false;
            } else if (isPressed && wasPressed) {
                // Held — allow repeat for D-Pad after delay
                if ([BTN.DPAD_UP, BTN.DPAD_DOWN, BTN.DPAD_LEFT, BTN.DPAD_RIGHT].includes(idx)) {
                    if (now - _lastInput > REPEAT_DELAY) {
                        handleButton(idx, gp.axes);
                        _lastInput = now;
                    }
                }
            }
        });

        _rafId = requestAnimationFrame(pollGamepad);
    }

    function handleButton(idx, axes) {
        switch (idx) {
            case BTN.CROSS:     handleConfirm(); break;
            case BTN.CIRCLE:    handleBack();    break;
            case BTN.SQUARE:    handleFavorite(); break;
            case BTN.TRIANGLE:  handleSearch();  break;
            case BTN.DPAD_UP:   moveFocus('up');    break;
            case BTN.DPAD_DOWN: moveFocus('down');  break;
            case BTN.DPAD_LEFT: moveFocus('left');  break;
            case BTN.DPAD_RIGHT:moveFocus('right'); break;
            case BTN.L1:        handleTabPrev(); break;
            case BTN.R1:        handleTabNext(); break;
            case BTN.START:     handleStart();   break;
        }
    }

    /* ── Keyboard fallback (useful for testing) ─────────── */
    function initKeyboard() {
        document.addEventListener('keydown', e => {
            switch (e.key) {
                case 'ArrowUp':    e.preventDefault(); moveFocus('up');    break;
                case 'ArrowDown':  e.preventDefault(); moveFocus('down');  break;
                case 'ArrowLeft':  e.preventDefault(); moveFocus('left');  break;
                case 'ArrowRight': e.preventDefault(); moveFocus('right'); break;
                case 'Enter':
                case ' ':          handleConfirm(); break;
                case 'Backspace':
                case 'Escape':     handleBack();    break;
                case 'f':
                case 'F':          handleFavorite(); break;
                case 's':
                case 'S':          handleSearch();  break;
                case 'Tab':
                    e.preventDefault();
                    e.shiftKey ? handleTabPrev() : handleTabNext();
                    break;
            }
        });
    }

    /* ── Focus Movement ────────────────────────────────── */
    function getFocusableElements() {
        const screen = document.querySelector('.screen.active');
        if (!screen) return [];
        return Array.from(screen.querySelectorAll('.focusable, [tabindex="0"]'))
            .filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && !el.disabled && el.offsetParent !== null;
            });
    }

    function getCurrentFocused() {
        return document.activeElement;
    }

    function moveFocus(direction) {
        const elements  = getFocusableElements();
        if (elements.length === 0) return;

        const focused   = getCurrentFocused();
        const idx       = elements.indexOf(focused);

        if (idx < 0) {
            // Nothing focused — focus first
            elements[0].focus();
            return;
        }

        const focusedRect = focused.getBoundingClientRect();
        const cx = focusedRect.left + focusedRect.width / 2;
        const cy = focusedRect.top  + focusedRect.height / 2;

        let best = null;
        let bestScore = Infinity;

        elements.forEach((el, i) => {
            if (el === focused) return;
            const r  = el.getBoundingClientRect();
            const ex = r.left + r.width / 2;
            const ey = r.top  + r.height / 2;

            let dx = ex - cx;
            let dy = ey - cy;

            let inDirection = false;
            let primaryDist, secondaryDist;

            switch (direction) {
                case 'up':
                    inDirection   = dy < -5;
                    primaryDist   = -dy;
                    secondaryDist = Math.abs(dx);
                    break;
                case 'down':
                    inDirection   = dy > 5;
                    primaryDist   = dy;
                    secondaryDist = Math.abs(dx);
                    break;
                case 'left':
                    inDirection   = dx < -5;
                    primaryDist   = -dx;
                    secondaryDist = Math.abs(dy);
                    break;
                case 'right':
                    inDirection   = dx > 5;
                    primaryDist   = dx;
                    secondaryDist = Math.abs(dy);
                    break;
            }

            if (!inDirection) return;

            const score = primaryDist + secondaryDist * 2;
            if (score < bestScore) { bestScore = score; best = el; }
        });

        if (best) {
            best.focus();
            best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } else {
            // Wrap: go to first in direction
            if (direction === 'down' || direction === 'right') {
                elements[0].focus();
            } else {
                elements[elements.length - 1].focus();
            }
        }
    }

    /* ── Action Handlers ───────────────────────────────── */
    function handleConfirm() {
        const el = getCurrentFocused();
        if (el) el.click();
    }

    function handleBack() {
        App.goBack();
    }

    function handleFavorite() {
        App.toggleFavoriteFromPlayer();
    }

    function handleSearch() {
        App.showScreen('screen-search');
        setTimeout(() => {
            const input = document.getElementById('search-input');
            if (input) input.focus();
        }, 100);
    }

    function handleTabNext() {
        const tabs = Array.from(document.querySelectorAll('.tab-btn'));
        if (tabs.length === 0) return;
        const active = tabs.findIndex(t => t.classList.contains('active'));
        const next   = (active + 1) % tabs.length;
        tabs[next].click();
        tabs[next].focus();
    }

    function handleTabPrev() {
        const tabs = Array.from(document.querySelectorAll('.tab-btn'));
        if (tabs.length === 0) return;
        const active = tabs.findIndex(t => t.classList.contains('active'));
        const prev   = (active - 1 + tabs.length) % tabs.length;
        tabs[prev].click();
        tabs[prev].focus();
    }

    function handleStart() {
        // Start → toggle player controls if in player screen
        const playerScreen = document.getElementById('screen-player');
        if (playerScreen && playerScreen.classList.contains('active')) {
            Player.toggleControls();
        }
    }

    /* ── Focus first element on screen change ─────────── */
    function focusFirstInScreen(screenId) {
        setTimeout(() => {
            const screen = document.getElementById(screenId);
            if (!screen) return;
            const first = screen.querySelector('.focusable, [tabindex="0"]');
            if (first) first.focus();
        }, 150);
    }

    function init() {
        initKeyboard();
        startGamepadPolling();
    }

    return { init, moveFocus, focusFirstInScreen };
})();
