import { appIcon } from '../lib/appIcons';
import { Icon, type IconSize } from './Icon';

/** An icon named by a shared registry key (an app, a setup tag, a goal, a role...), drawn through the one `Icon`. */
export function AppIcon({ name, size = 20, label, className }: { name: string | undefined | null; size?: IconSize; label?: string; className?: string }) {
  return <Icon icon={appIcon(name)} size={size} label={label} className={className} />;
}
