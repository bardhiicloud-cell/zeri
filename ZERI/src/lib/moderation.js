export const BAD_WORDS = [
    'mut', 'kari', 'pidh', 'kudra', 'kurve', 'byth', 'kar', 'budall', 'idiot', 'pordh', 'muti', 'kaur', 'shkja',
    'fuck', 'shit', 'bitch', 'ass', 'dick', 'cunt', 'whore', 'slut', 'bastard', 'asshole',
    'nudo', 'zhveshur', 'seks', 'vrasje'
];
export function hasProfanity(text) {
    const lowerText = text.toLowerCase();
    return BAD_WORDS.some(word => {
        // Create a regex that matches repeating characters for each bad word
        // e.g., 'kari' -> 'k+a+r+i+'
        const regexStr = word.split('').map(char => char + '+').join('');
        // Check with word boundaries to avoid false positives (e.g. 'ass' in 'class')
        const match = new RegExp(`\\b${regexStr}\\b`, 'i').test(lowerText);
        // Additionally, if the string has no spaces and is just a long swear word
        const matchSub = new RegExp(`^${regexStr}$`, 'i').test(lowerText);
        return match || matchSub;
    });
}
export function isSpam(text) {
    // Check for excessive repeated characters
    if (/(.)\1{5,}/.test(text))
        return true;
    // Check for ALL CAPS in longer messages
    const lettersOnly = text.replace(/[^a-zA-Z]/g, '');
    if (lettersOnly.length > 8 && lettersOnly === lettersOnly.toUpperCase())
        return true;
    return false;
}
export function validateComment(text) {
    if (hasProfanity(text)) {
        return { valid: false, error: "Ju lutem përdorni gjuhë të përshtatshme. Fjalët banale nuk lejohen." };
    }
    if (isSpam(text)) {
        return { valid: false, error: "Mesazhi juaj u identifikua si spam. Ju lutem shkruani një mesazh normal." };
    }
    return { valid: true };
}
export async function validateReportByAI(title, description) {
    return { valid: true };
}
export async function forensicCheck(text) {
    return { valid: true };
}
