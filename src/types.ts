export type AppView =
  | "dashboard"
  | "campaign"
  | "assets"
  | "templates"
  | "template-editor"
  | "whatsapp-templates"
  | "whatsapp-template-editor"
  | "whatsapp-send";

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

export type WhatsAppButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";

export type WhatsAppButton = {
  type: WhatsAppButtonType;
  text: string;
  value?: string; // URL o teléfono según el tipo
};

export type WhatsAppCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export type WhatsAppTemplate = {
  id: string;
  name: string; // nombre exacto aprobado en YCloud/Meta
  language: string; // ej. es, es_AR, en
  category: WhatsAppCategory;
  headerText: string; // encabezado estático ("" si no tiene)
  bodyText: string; // cuerpo con variables {{1}} {{2}}
  footerText: string;
  buttons: WhatsAppButton[];
  createdAt: string;
  updatedAt: string;
};
