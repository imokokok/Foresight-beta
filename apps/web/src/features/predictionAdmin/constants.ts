import type { PredictionForm, Outcome } from "./types";

export const DRAFT_KEY = "admin_prediction_new_draft_v1";

export const DEFAULT_FORM: PredictionForm = {
  title: "",
  description: "",
  category: "tech",
  deadline: "",
  minStake: 1,
  criteria: "",
  type: "binary",
};

export const DEFAULT_OUTCOMES: Outcome[] = [{ label: "Yes" }, { label: "No" }];
