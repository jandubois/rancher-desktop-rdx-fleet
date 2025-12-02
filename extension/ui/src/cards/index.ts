export * from './types';
export { CardWrapper } from './CardWrapper';
export {
  registerCard,
  getCardComponent,
  getCardMetadata,
  isCardTypeRegistered,
  getRegisteredCardTypes,
  getOrderableCardTypes,
  getAddCardMenuItems,
  getDefaultSettingsForType,
} from './registry';
export type { CardTypeMetadata } from './registry';

// Import card components to trigger registration
import './MarkdownCard';
import './HtmlCard';
import './ImageCard';
import './VideoCard';
import './LinkCard';
import './DividerCard';
import './AuthGitHubCard';
import './AuthAppCoCard';
// Future: import './GitRepoCard';
