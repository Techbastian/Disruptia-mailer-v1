export type AppView = "dashboard" | "campaign" | "assets" | "templates" | "template-editor";

export type ContactRecord = {
  email: string;
  firstName?: string;
  lastName?: string;
  [key: string]: string | undefined;
};

export type CampaignMetrics = {
  totalLoaded: number;
  validEmails: number;
  invalidEmails: number;
  duplicatesRemoved: number;
};

export type AssetItem = {
  id: string;
  name: string;
  publicUrl: string;
  createdAt: string;
  kind: "image" | "html_template" | "template";
};

export type CampaignHistoryItem = {
  id: string;
  title: string;
  createdAt: string;
  recipients: number;
  status: "draft" | "queued" | "sent" | "failed";
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
};

export type EmailTemplate = {
  id: string;
  name: string;
  description: string;
  html: string;
  variablesCsv: string[];
  variablesCampaign: string[];
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};
