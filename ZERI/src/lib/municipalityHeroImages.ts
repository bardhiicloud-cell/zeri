import heroCityImg from '../assets/images/hero_city_modern_1789826592815.webp';
import { getMunicipalityPhoto } from './municipalityPhotos';

/**
 * Daytime photograph of a municipality (src/assets/municipalities, credited in municipalityPhotoCredits.ts).
 * It used to map most municipalities to unrelated stock landscapes from a third-party host; those are gone,
 * so a municipality is only ever shown with a picture of itself. Anything unknown gets the neutral city image.
 */
export function getMunicipalityHeroImage(municipality?: string | null) {
  return (municipality && getMunicipalityPhoto(municipality, 'day')) || heroCityImg;
}
