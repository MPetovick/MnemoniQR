export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const debounce = (fn, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
};
