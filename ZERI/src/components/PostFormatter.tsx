
interface PostFormatterProps {
  content: string;
  onHashtagClick?: (hashtag: string) => void;
}

export function PostFormatter({ content, onHashtagClick }: PostFormatterProps) {
  if (!content) return null;
  
  // Split by whitespace but keep the tokens
  const words = content.split(/(\s+)/);
  
  return (
    <span className="whitespace-pre-wrap">
      {words.map((word, index) => {
        if (word.startsWith('@') && word.length > 1) {
          return <span key={index} className="text-blue-600 font-medium hover:underline cursor-pointer">{word}</span>;
        }
        if (word.startsWith('#') && word.length > 1) {
          return (
            <span 
              key={index} 
              onClick={() => onHashtagClick?.(word)}
              className="text-emerald-600 font-medium hover:underline cursor-pointer"
            >
              {word}
            </span>
          );
        }
        return <span key={index}>{word}</span>;
      })}
    </span>
  );
}
