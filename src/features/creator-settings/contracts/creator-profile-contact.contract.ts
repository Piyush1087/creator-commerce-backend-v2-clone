import type {
  CreatorWorkspaceAction,
  CreatorWorkspaceActorRole,
} from "../../../shared/creator/creator-workspace-actor.contract";

export type CreatorProfileSettingsContract = {
  actor_role: CreatorWorkspaceActorRole;
  allowed_actions: readonly CreatorWorkspaceAction[];
  can_manage_personal_name: boolean;
  profile: {
    user_name: string | null;
    display_name: string | null;
    email: string;
    avatar_url: string | null;
    primary_region: string;
  };
  organization: {
    organization_id: string;
    name: string;
  };
};

export type CreatorDefaultContactContract = {
  actor_role: CreatorWorkspaceActorRole;
  allowed_actions: readonly CreatorWorkspaceAction[];
  default_contact: {
    contact_id: string;
    recipient_name: string;
    address_line_1: string;
    address_line_2: string | null;
    city: string;
    state_region: string | null;
    postal_code: string;
    country_code: string;
    phone: {
      country_calling_code: string;
      national_number: string;
      e164: string;
    } | null;
    has_legacy_unstructured_phone: boolean;
    delivery_instructions: string | null;
    updated_at: string;
  } | null;
};
