//types/community.ts
export type CommunityType = 'support' | 'professional' | '';

export interface CreateCommunityData {
  name: string;
  description: string;
  type: CommunityType;
}