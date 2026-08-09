export interface RazorpayPlanItem {
  name: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface RazorpaySubscriptionNotes {
  brand_profile_id?: string;
  target_tier?: string;
}

export interface RazorpayPlanEntity {
  id: string;
  entity?: string;
  interval: number;
  period: string;
  item: RazorpayPlanItem;
  plan_id?: string;
  status?: string;
  notes?: RazorpaySubscriptionNotes;
  current_start?: number;
  current_end?: number;
}

export interface RazorpayPlanCollection {
  entity: string;
  count: number;
  items: RazorpayPlanEntity[];
}
