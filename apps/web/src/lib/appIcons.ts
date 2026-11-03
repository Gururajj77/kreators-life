// The icons the shared registries name (apps, setup tags, goals, blockers, roles, permissions, knowledge kinds).
// Shared stays free of React, so it stores a key (`IconName`) and this one map turns it into a lucide-react icon.
// `satisfies Record<IconName, LucideIcon>` makes the type check fail when a key has no icon here.
// vite.config.ts puts this file in its own chunk (`icons-app`), so the entry stays under its budget.
import type { IconName } from '@kreators/shared';
import type { LucideIcon } from 'lucide-react';
import {
  Aperture, ArrowRight, Backpack, BadgeDollarSign, Ban, Banknote, BatteryLow, Bell, BookOpen, Bot, Brain, Briefcase, BriefcaseBusiness,
  CalendarClock, CalendarRange, Camera, Cast, Check, CircleAlert, CircleCheck, CircleCheckBig, CirclePlus, CircleQuestionMark,
  Clapperboard, ClipboardCheck, Coins, Compass, CreditCard, Dumbbell, EighthNotes, FaceGrinning, FaceSlightlySmiling,
  FileDown, FileText, Flame, Flower2, FolderKanban, Footprints, Gamepad2, GraduationCap, HandCoins, HandHeart, HandHelping, Handshake, Headphones,
  Heart, HeartPulse, Hourglass, House, IdCard, KeyRound, Landmark, LayoutList, LifeBuoy, Lightbulb, Link, ListChecks, ListPlus, Lock, Luggage,
  Mail, Medal, Megaphone, MessageCircle, MessageCircleHeart,
  MessagesSquare, MicSignal, MicVocal, Minus, Moon, MoonStar, NotebookPen, Package, Palette, PartyPopper, PenLine, PiggyBank, Plane, Presentation,
  Puzzle, RadioTower, Recycle, Repeat, Rocket, Scissors, Search, SearchCheck, Share2, Shield, ShieldCheck, ShoppingBag, ShoppingCart,
  Signpost, Smartphone, Spade, Sparkle, Sparkles, SquareCheck, Sprout, Sun, Sunrise, Tag, Target, Telescope, ThumbsUp, Ticket, Toolbox, Tornado, TrendingUp,
  Triangle, Trophy, Tv, Type, Undo2, UserRound, UsersRound, Video, Wallet, WalletMinimal, WandSparkles, WavesHorizontal, Wind, X,
} from 'lucide-react';

export const APP_ICONS = {
  Aperture, ArrowRight, Backpack, BadgeDollarSign, Ban, Banknote, BatteryLow, Bell, BookOpen, Bot, Brain, Briefcase, BriefcaseBusiness,
  CalendarClock, CalendarRange, Camera, Cast, Check, CircleAlert, CircleCheck, CircleCheckBig, CirclePlus, CircleQuestionMark,
  Clapperboard, ClipboardCheck, Coins, Compass, CreditCard, Dumbbell, EighthNotes, FaceGrinning, FaceSlightlySmiling,
  FileDown, FileText, Flame, Flower2, FolderKanban, Footprints, Gamepad2, GraduationCap, HandCoins, HandHeart, HandHelping, Handshake, Headphones,
  Heart, HeartPulse, Hourglass, House, IdCard, KeyRound, Landmark, LayoutList, LifeBuoy, Lightbulb, Link, ListChecks, ListPlus, Lock, Luggage,
  Mail, Medal, Megaphone, MessageCircle, MessageCircleHeart,
  MessagesSquare, MicSignal, MicVocal, Minus, Moon, MoonStar, NotebookPen, Package, Palette, PartyPopper, PenLine, PiggyBank, Plane, Presentation,
  Puzzle, RadioTower, Recycle, Repeat, Rocket, Scissors, Search, SearchCheck, Share2, Shield, ShieldCheck, ShoppingBag, ShoppingCart,
  Signpost, Smartphone, Spade, Sparkle, Sparkles, SquareCheck, Sprout, Sun, Sunrise, Tag, Target, Telescope, ThumbsUp, Ticket, Toolbox, Tornado, TrendingUp,
  Triangle, Trophy, Tv, Type, Undo2, UserRound, UsersRound, Video, Wallet, WalletMinimal, WandSparkles, WavesHorizontal, Wind, X,
} satisfies Record<IconName, LucideIcon>;

/** The lucide icon for a key; a key from an older server or a stray string falls back to a tag. */
export function appIcon(name: string | undefined | null): LucideIcon {
  return name && Object.hasOwn(APP_ICONS, name) ? APP_ICONS[name as IconName] : Tag;
}
