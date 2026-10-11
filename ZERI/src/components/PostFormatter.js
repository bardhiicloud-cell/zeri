import { jsx as _jsx } from "react/jsx-runtime";
export function PostFormatter({ content, onHashtagClick }) {
    if (!content)
        return null;
    // Split by whitespace but keep the tokens
    const words = content.split(/(\s+)/);
    return (_jsx("span", { className: "whitespace-pre-wrap", children: words.map((word, index) => {
            if (word.startsWith('@') && word.length > 1) {
                return _jsx("span", { className: "text-blue-600 font-medium hover:underline cursor-pointer", children: word }, index);
            }
            if (word.startsWith('#') && word.length > 1) {
                return (_jsx("span", { onClick: () => onHashtagClick?.(word), className: "text-emerald-600 font-medium hover:underline cursor-pointer", children: word }, index));
            }
            return _jsx("span", { children: word }, index);
        }) }));
}
