// The icons the shared registries name (apps, setup tags, goals, blockers, roles, permissions, knowledge kinds).
// Shared stays free of React, so it stores a key (`IconName`) and this one map turns it into a lucide-react icon.
// `satisfies Record<IconName, LucideIcon>` makes the type check fail when a key has no icon here.
// vite.config.ts puts this file in its own chunk (`icons-app`), so the entry stays under its budget.
import type { IconName } from '@kreators/shared';
import type { LucideIcon } from 'lucide-react';
import {
  Activity, Anchor, Aperture, ArrowRight, AtSign, Award, Backpack, BadgeCheck, BadgeDollarSign, Ban, Banknote, BatteryLow, Bell, BellRing,
  BookBookmark, BookOpen, Bot, Brain, BrickWall, Briefcase, BriefcaseBusiness, BuildingComplex, CalendarClock, CalendarDays, CalendarRange, Camera,
  Cast, Castle, ChartLine, Check, CircleAlert, CircleCheck, CircleCheckBig, CirclePlus, CircleQuestionMark, Clapperboard, ClipboardCheck, CloudRain,
  Coffee, Coins, Compass, Construction, CreditCard, Crown, Disc3, Dumbbell, Earth, EighthNote, EighthNotes, FaceGrinning, FaceSlightlySmiling,
  Feather, FileDown, FileText, Flag, Flame, FlaskConical, Flower2, FolderCheck, FolderKanban, Footprints, GalleryHorizontal, Gamepad2, Gem, Gift,
  Globe, GraduationCap, Hammer, HandCoins, HandHeart, HandHelping, Handshake, Headphones, Heart, HeartPulse, Hourglass, House, IdCard, Image,
  KeyRound, Landmark, LayoutList, Leaf, LetterH, LifeBuoy, Lightbulb, Link, ListChecks, ListPlus, Lock, Luggage, Mail, Map, Medal, Megaphone,
  MessageCircle, MessageCircleHeart, MessagesSquare, MicSignal, MicVocal, Minus, Moon, MoonStar, Mountain, Newspaper, NotebookPen, NotebookText,
  OctagonX, Orbit, Package, Palette, PartyPopper, PenLine, PersonStanding, PiggyBank, Pill, Plane, Presentation, Puzzle, RadioTower, Rainbow, Receipt,
  Recycle, Repeat, Rocket, Route, ScanSearch, Scissors, Search, SearchCheck, Share2, Shield, ShieldCheck, Shirt, ShoppingBag, ShoppingCart, Signpost,
  Smartphone, Spade, Sparkle, Sparkles, Speech, Sprout, SquareCheck, SquarePlay, Star, Store, Sun, Sunrise, Swords, Table2, Tag, Target, Telescope, Tent,
  ThumbsUp, Ticket, Toolbox, Tornado, TreeDeciduous, TreePine, TrendingUp, Triangle, Trophy, Tv, Type, Undo2, UserRound, Users, UsersRound,
  UtensilsCrossed, Video, VolumeX, Wallet, WalletMinimal, WandSparkles, WavesHorizontal, Wind, X, Zap,
} from 'lucide-react';

export const APP_ICONS = {
  Activity, Anchor, Aperture, ArrowRight, AtSign, Award, Backpack, BadgeCheck, BadgeDollarSign, Ban, Banknote, BatteryLow, Bell, BellRing,
  BookBookmark, BookOpen, Bot, Brain, BrickWall, Briefcase, BriefcaseBusiness, BuildingComplex, CalendarClock, CalendarDays, CalendarRange, Camera,
  Cast, Castle, ChartLine, Check, CircleAlert, CircleCheck, CircleCheckBig, CirclePlus, CircleQuestionMark, Clapperboard, ClipboardCheck, CloudRain,
  Coffee, Coins, Compass, Construction, CreditCard, Crown, Disc3, Dumbbell, Earth, EighthNote, EighthNotes, FaceGrinning, FaceSlightlySmiling,
  Feather, FileDown, FileText, Flag, Flame, FlaskConical, Flower2, FolderCheck, FolderKanban, Footprints, GalleryHorizontal, Gamepad2, Gem, Gift,
  Globe, GraduationCap, Hammer, HandCoins, HandHeart, HandHelping, Handshake, Headphones, Heart, HeartPulse, Hourglass, House, IdCard, Image,
  KeyRound, Landmark, LayoutList, Leaf, LetterH, LifeBuoy, Lightbulb, Link, ListChecks, ListPlus, Lock, Luggage, Mail, Map, Medal, Megaphone,
  MessageCircle, MessageCircleHeart, MessagesSquare, MicSignal, MicVocal, Minus, Moon, MoonStar, Mountain, Newspaper, NotebookPen, NotebookText,
  OctagonX, Orbit, Package, Palette, PartyPopper, PenLine, PersonStanding, PiggyBank, Pill, Plane, Presentation, Puzzle, RadioTower, Rainbow, Receipt,
  Recycle, Repeat, Rocket, Route, ScanSearch, Scissors, Search, SearchCheck, Share2, Shield, ShieldCheck, Shirt, ShoppingBag, ShoppingCart, Signpost,
  Smartphone, Spade, Sparkle, Sparkles, Speech, Sprout, SquareCheck, SquarePlay, Star, Store, Sun, Sunrise, Swords, Table2, Tag, Target, Telescope, Tent,
  ThumbsUp, Ticket, Toolbox, Tornado, TreeDeciduous, TreePine, TrendingUp, Triangle, Trophy, Tv, Type, Undo2, UserRound, Users, UsersRound,
  UtensilsCrossed, Video, VolumeX, Wallet, WalletMinimal, WandSparkles, WavesHorizontal, Wind, X, Zap,
} satisfies Record<IconName, LucideIcon>;

/** The lucide icon for a key; a key from an older server or a stray string falls back to a tag. */
export function appIcon(name: string | undefined | null): LucideIcon {
  return name && Object.hasOwn(APP_ICONS, name) ? APP_ICONS[name as IconName] : Tag;
}
