export const runValidations = (validators) => {
    const errors = validators.map(v => v()).filter(Boolean);
    return { isValid: errors.length === 0, errors };
};
export const validations = {
    isRequired: (value, fieldName) => {
        return !value || value.trim() === '' ? `Fusha "${fieldName}" është e detyrueshme.` : null;
    },
    minLength: (value, min, fieldName) => {
        return value.trim().length < min ? `Fusha "${fieldName}" duhet të ketë të paktën ${min} karaktere.` : null;
    },
    maxLength: (value, max, fieldName) => {
        return value.trim().length > max ? `Fusha "${fieldName}" duhet të ketë maksimumi ${max} karaktere.` : null;
    },
    isEmail: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !emailRegex.test(value) ? `Formati i email-it është i pasaktë.` : null;
    },
    isPhone: (value) => {
        const phoneRegex = /^\+?383\s?[4-6][0-9]\s?[0-9]{3}\s?[0-9]{3}$/;
        return !phoneRegex.test(value) ? `Numri i telefonit duhet të jetë në formatin Kosovar (psh. +383 4X XXX XXX)` : null;
    },
    isValidUrl: (value, fieldName) => {
        if (!value)
            return null; // Opsionale nese lejohet e zbrazet - check isRequired nese duhet patjeter
        try {
            new URL(value);
            return null;
        }
        catch {
            return `Fusha "${fieldName}" duhet të jetë një URL e vlefshme.`;
        }
    }
};
