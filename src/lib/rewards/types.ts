export type RewardsPodiumEntry = {
  rank: 1 | 2 | 3;
  id: string;
  name: string;
  points: number;
  avatar_url: string | null;
};

export type EstablishmentRewardCatalogItem = {
  id: string;
  title: string;
  short_description: string;
  long_description: string | null;
  image_url: string | null;
  value_tonkis: number;
  value_usd: number;
  establishment_id: string;
  establishment_name: string;
};

export type RewardsPagePayload = {
  role: "admin" | "user";
  greeting_name: string;
  total_points: number;
  leaderboard: RewardsPodiumEntry[];
  consumptions: RewardsPodiumEntry[];
  catalog: EstablishmentRewardCatalogItem[];
};
