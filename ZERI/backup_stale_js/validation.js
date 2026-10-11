/**
 * Password and account validation shared by the register and reset forms.
 *
 * At national scale the password is the only thing standing between a stolen
 * database and a few hundred thousand citizen accounts, so the policy is
 * enforced here rather than left to each form. It mirrors the NIST SP 800-63B
 * guidance that Kosovo's Law 06/L-082 refers to indirectly: length over
 * composition rules, a breached-password blocklist, and no forced rotation.
 */
/** Minimum length. Eight characters is the current OWASP recommendation. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
/**
 * Passwords that appear in every breach corpus. Firebase's own
 * `checkPasswordStrength`-style blocking is not enough on its own, so the most
 * damaging ones are rejected outright.
 */
const BLOCKLIST = new Set([
    'password', 'password1', 'password123', '123456', '12345678', '123456789',
    'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'monkey', 'dragon',
    'iloveyou', 'admin', 'administrator', 'root', 'toor', 'passw0rd',
    'kosova', 'kosovo', 'qytetar', 'qytetaret', 'zëriqytetarëve', 'zieri',
    'prishtina', 'peja', 'gjakova', 'football', 'baseball', 'sunshine',
]);
/** Sequences and repeats that add no entropy but defeat naive length checks. */
const SEQUENCES = [
    '0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
];
export function validatePassword(password) {
    const problems = [];
    const suggestions = [];
    const value = password ?? '';
    if (value.length < MIN_PASSWORD_LENGTH) {
        problems.push(`Fjalëkalimi duhet të ketë të paktën ${MIN_PASSWORD_LENGTH} shenja.`);
    }
    if (value.length > MAX_PASSWORD_LENGTH) {
        problems.push(`Fjalëkalimi nuk mund të jetë më i gjatë se ${MAX_PASSWORD_LENGTH} shenja.`);
    }
    if (value.length > 0 && BLOCKLIST.has(value.toLowerCase())) {
        problems.push('Ky fjalëkalim është në listën e fjalëkalimeve të dobëta. Zgjidhni një tjetër.');
    }
    // A run of 4 identical characters adds nothing: "aaaa" passes a length check
    // but carries under a bit of entropy.
    if (/(.)\1{3,}/.test(value)) {
        problems.push('Shenjat e njëjta nuk duhet të përsëriten katër herë radhazi.');
    }
    for (const sequence of SEQUENCES) {
        for (let i = 0; i + 4 <= sequence.length; i += 1) {
            if (value.toLowerCase().includes(sequence.slice(i, i + 4))) {
                problems.push('Shmangni sekuenca të thjeshta si "1234" ose "abcd".');
                break;
            }
        }
    }
    /**
     * Score by variety rather than by mandatory character classes. A long
     * passphrase ("Correct-Horse-Battery-Staple-77") is stronger than a short
     * one that merely contains a symbol, and forcing classes pushes people
     * towards "Password1!".
     */
    let variety = 0;
    if (/[a-z]/.test(value))
        variety += 1;
    if (/[A-Z]/.test(value))
        variety += 1;
    if (/[0-9]/.test(value))
        variety += 1;
    if (/[^\p{L}\p{N}]/u.test(value))
        variety += 1;
    const lengthScore = value.length >= 8 ? 0 : value.length >= 6 ? 1 : 2;
    const score = Math.max(0, Math.min(4, lengthScore + variety - 1));
    const labels = ['Shumë e dobët', 'E dobët', 'Mesatare', 'E mirë', 'Shumë e mirë'];
    if (value.length === 0) {
        return { ok: false, score: 0, label: '—', problems, suggestions };
    }
    if (variety < 3 && value.length < 14) {
        suggestions.push('Përdorni një kombinim fjalësh ose frazë që keni kuptueshme.');
    }
    if (value.length < 12) {
        suggestions.push('Të paktën 12 shenja e bëjnë shumë më të vështirë për t\'u thyer.');
    }
    if (!/[\p{L}]/u.test(value)) {
        suggestions.push('Shtoni një ose disa shkronja.');
    }
    if (!/[0-9]/.test(value)) {
        suggestions.push('Shtoni një ose disa numra.');
    }
    return {
        ok: problems.length === 0 && value.length >= MIN_PASSWORD_LENGTH,
        score,
        label: labels[score],
        problems,
        suggestions,
    };
}
/** Kosovo mobile numbers: +383 or 0, then 4x/49/44/45/50 and 6 more digits. */
const PHONE_PATTERN = /^(?:\+?383|0)\s?[1-9]\d{1}\s?[\d\s]{6,8}$/;
export function validatePhone(phone) {
    return PHONE_PATTERN.test((phone ?? '').trim());
}
export function normalisePhone(phone) {
    const digits = (phone ?? '').replace(/[^\d+]/g, '');
    if (digits.startsWith('+383'))
        return digits;
    if (digits.startsWith('383'))
        return `+${digits}`;
    if (digits.startsWith('0'))
        return `+383${digits.slice(1)}`;
    return digits;
}
/**
 * Email is only ever validated for shape here.
 *
 * Sending a verification code and waiting for the round trip is the only
 * reliable ownership check, and that is what `sendEmailVerification` does after
 * the account is created. A regex gate in addition to that only rejects valid
 * addresses.
 */
export function validateEmailShape(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email ?? '').trim());
}
/** Names: at least two words, letters (including Albanian diacritics) and spaces. */
export function validateName(name) {
    const value = (name ?? '').trim();
    if (value.length < 3 || value.length > 80)
        return false;
    return /^[\p{L}]+(?:[ '\-][\p{L}]+)+$/u.test(value);
}
