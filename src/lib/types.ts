export type Features = {
  menu?: boolean;
  review?: boolean;
  offers_strip?: boolean;
  keywords?: boolean;
  photo_limit?: number;
  complaints?: boolean;
  suggestions?: boolean;
  offers_card?: boolean;
  whatsapp_capture?: boolean;
  moments?: boolean;
  events?: boolean;
  membership?: boolean;
  creators?: boolean;
  custom_links?: number;
};

export type CardKey =
  | "menu"
  | "review"
  | "complaint"
  | "suggestion"
  | "moment"
  | "offers"
  | "events"
  | "membership"
  | "creators";

export type GuestPageData = {
  live: boolean;
  plate: { code: string; label: string | null } | null;
  client: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    logo_url: string | null;
    theme: string;
    google_review_url: string | null;
    menu_url: string | null;
    business_type: string | null;
    socials: Partial<Record<"instagram" | "facebook" | "maps" | "phone" | "zomato" | "swiggy", string>>;
    keywords: string[];
    review_chips: string[];
    card_config: {
      order?: CardKey[];
      hidden?: CardKey[];
      copy?: Partial<Record<CardKey, { title?: string; help?: string }>>;
    };
    card_copy: Partial<Record<CardKey, { title?: string; help?: string }>>;
  };
  features: Features;
  gallery: { url: string; label: string | null; caption: string | null }[];
  offers: { id: string; title: string; details: string | null; starts_at: string | null; ends_at: string | null; claimable: boolean }[];
  events: { title: string; details: string | null; starts_at: string }[];
  reviews: { author: string; rating: number; body: string | null }[];
  links?: { label: string; url: string }[];
  review?: { questions?: unknown; max_questions?: number; languages?: string[]; low_star_mode?: string };
};
