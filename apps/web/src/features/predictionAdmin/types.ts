export type Outcome = {
  label: string;
  description?: string;
  color?: string;
  image_url?: string;
};

export type PredictionForm = {
  title: string;
  description: string;
  category: string;
  deadline: string;
  minStake: number | string;
  criteria: string;
  type: "binary" | "multi";
};
