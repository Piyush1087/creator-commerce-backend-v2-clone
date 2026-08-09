import { Injectable } from "@nestjs/common";

export type CampaignMemoryRow = {
  id: string;
  name: string;
  status: string;
};

export type CollaborationMemoryRow = {
  id: string;
  name: string;
  stage: string;
  campaignName: string;
};

export type ThreadCampaignMemory = {
  listedCampaigns: CampaignMemoryRow[];
  selectedCampaignId?: string;
  selectedCampaignName?: string;
  updatedAt: number;
};

export type ThreadCollaborationMemory = {
  listedCollaborations: CollaborationMemoryRow[];
  selectedCollaborationId?: string;
  selectedCollaborationName?: string;
  selectedStage?: string;
  updatedAt: number;
};

const TTL_MS = 1000 * 60 * 60 * 6;

@Injectable()
export class CoPilotConversationMemoryService {
  private readonly byThread = new Map<string, ThreadCampaignMemory>();
  private readonly collabByThread = new Map<string, ThreadCollaborationMemory>();

  getCampaignMemory(threadId: string): ThreadCampaignMemory | null {
    const row = this.byThread.get(threadId);
    if (!row) return null;
    if (Date.now() - row.updatedAt > TTL_MS) {
      this.byThread.delete(threadId);
      return null;
    }
    return row;
  }

  rememberListedCampaigns(
    threadId: string,
    campaigns: CampaignMemoryRow[],
  ): void {
    const prev = this.getCampaignMemory(threadId);
    this.byThread.set(threadId, {
      listedCampaigns: campaigns.slice(0, 50),
      selectedCampaignId: prev?.selectedCampaignId,
      selectedCampaignName: prev?.selectedCampaignName,
      updatedAt: Date.now(),
    });
  }

  rememberSelectedCampaign(
    threadId: string,
    campaign: { id: string; name: string },
  ): void {
    const prev = this.getCampaignMemory(threadId);
    this.byThread.set(threadId, {
      listedCampaigns: prev?.listedCampaigns ?? [
        { id: campaign.id, name: campaign.name, status: "" },
      ],
      selectedCampaignId: campaign.id,
      selectedCampaignName: campaign.name,
      updatedAt: Date.now(),
    });
  }

  getCollaborationMemory(threadId: string): ThreadCollaborationMemory | null {
    const row = this.collabByThread.get(threadId);
    if (!row) return null;
    if (Date.now() - row.updatedAt > TTL_MS) {
      this.collabByThread.delete(threadId);
      return null;
    }
    return row;
  }

  rememberListedCollaborations(
    threadId: string,
    collaborations: CollaborationMemoryRow[],
  ): void {
    const prev = this.getCollaborationMemory(threadId);
    this.collabByThread.set(threadId, {
      listedCollaborations: collaborations.slice(0, 50),
      selectedCollaborationId: prev?.selectedCollaborationId,
      selectedCollaborationName: prev?.selectedCollaborationName,
      selectedStage: prev?.selectedStage,
      updatedAt: Date.now(),
    });
  }

  rememberSelectedCollaboration(
    threadId: string,
    collab: {
      id: string;
      name: string;
      stage?: string;
      campaignName?: string;
    },
  ): void {
    const prev = this.getCollaborationMemory(threadId);
    this.collabByThread.set(threadId, {
      listedCollaborations: prev?.listedCollaborations ?? [
        {
          id: collab.id,
          name: collab.name,
          stage: collab.stage ?? "",
          campaignName: collab.campaignName ?? "",
        },
      ],
      selectedCollaborationId: collab.id,
      selectedCollaborationName: collab.name,
      selectedStage: collab.stage,
      updatedAt: Date.now(),
    });
  }

  clear(threadId: string): void {
    this.byThread.delete(threadId);
    this.collabByThread.delete(threadId);
  }
}
