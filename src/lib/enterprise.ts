import { db } from "../db";
import type { Branch, CustomerReview, IntegrationSetting, LoyaltyEvent, MarketingCampaign, TrainingResource, User } from "../types";
import { newId } from "./id";

export async function listBranches(): Promise<Branch[]> {
  return db.branches.toArray();
}

export async function upsertBranch(branch: Branch): Promise<void> {
  await db.branches.put(branch);
}

export async function listCustomerReviews(): Promise<CustomerReview[]> {
  return db.customerReviews.orderBy("createdAt").reverse().toArray();
}

export async function listReviewsForCustomer(customerId: string): Promise<CustomerReview[]> {
  const rows = await db.customerReviews.where("customerId").equals(customerId).toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listReviewsForTechnician(technicianId: string): Promise<CustomerReview[]> {
  const rows = await db.customerReviews.where("technicianId").equals(technicianId).toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addCustomerReview(input: Omit<CustomerReview, "id" | "createdAt" | "public"> & { public?: boolean }): Promise<CustomerReview> {
  const row: CustomerReview = {
    id: newId("rev"),
    createdAt: new Date().toISOString(),
    public: input.public ?? true,
    ...input,
  };
  await db.customerReviews.put(row);
  return row;
}

export async function listLoyaltyEvents(customerId?: string): Promise<LoyaltyEvent[]> {
  if (!customerId) return db.loyaltyEvents.orderBy("createdAt").reverse().toArray();
  const rows = await db.loyaltyEvents.where("customerId").equals(customerId).toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function awardLoyaltyPoints(customerId: string, points: number, reason: string, referralCode?: string): Promise<LoyaltyEvent> {
  const row: LoyaltyEvent = {
    id: newId("loy"),
    customerId,
    createdAt: new Date().toISOString(),
    points,
    reason,
    referralCode,
  };
  await db.loyaltyEvents.put(row);
  return row;
}

export async function loyaltyBalance(customerId: string): Promise<number> {
  const rows = await listLoyaltyEvents(customerId);
  return rows.reduce((sum, row) => sum + row.points, 0);
}

export async function loyaltyLeaderboard(): Promise<Array<{ user: User; points: number }>> {
  const customers = await db.users.where("role").equals("customer").toArray();
  const events = await db.loyaltyEvents.toArray();
  return customers
    .map((user) => ({ user, points: events.filter((e) => e.customerId === user.id).reduce((sum, e) => sum + e.points, 0) }))
    .sort((a, b) => b.points - a.points);
}

export async function listTrainingResources(): Promise<TrainingResource[]> {
  return db.trainingResources.toArray();
}

export async function upsertTrainingResource(resource: TrainingResource): Promise<void> {
  await db.trainingResources.put(resource);
}

export async function listCampaigns(): Promise<MarketingCampaign[]> {
  return db.marketingCampaigns.orderBy("createdAt").reverse().toArray();
}

export async function upsertCampaign(campaign: MarketingCampaign): Promise<void> {
  await db.marketingCampaigns.put(campaign);
}

export async function listIntegrationSettings(): Promise<IntegrationSetting[]> {
  return db.integrationSettings.toArray();
}

export async function setIntegrationEnabled(key: string, enabled: boolean): Promise<void> {
  const row = await db.integrationSettings.where("key").equals(key).first();
  if (row) {
    row.enabled = enabled;
    row.lastSyncAt = enabled ? new Date().toISOString() : row.lastSyncAt;
    await db.integrationSettings.put(row);
    return;
  }

  await db.integrationSettings.put({
    id: newId("int"),
    key,
    label: key,
    enabled,
    lastSyncAt: enabled ? new Date().toISOString() : undefined,
  });
}

export async function averageTechRating(technicianId: string): Promise<number> {
  const rows = await listReviewsForTechnician(technicianId);
  if (!rows.length) return 0;
  return Math.round((rows.reduce((sum, row) => sum + row.rating, 0) / rows.length) * 10) / 10;
}
