import { usePostView } from '../../lib/forumApi';

/**
 * Invisible overlay that records an impression once the post has been on screen.
 * The post card it lives in must be `relative`.
 */
export function PostViewSensor({ postId, enabled }: { postId: string; enabled: boolean }) {
  const ref = usePostView(postId, enabled);
  return <span ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}
