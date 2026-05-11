import { create } from "zustand";
import type { AppView, AssetItem, CampaignHistoryItem, CampaignMetrics, ContactRecord, EmailTemplate } from "../types";

type MailerState = {
  currentView: AppView;
  contacts: ContactRecord[];
  metrics: CampaignMetrics;
  prompt: string;
  generatedHtml: string;
  assets: AssetItem[];
  campaigns: CampaignHistoryItem[];
  templates: EmailTemplate[];
  selectedTemplateId: string | null;
  setCurrentView: (view: AppView) => void;
  setContacts: (contacts: ContactRecord[], metrics: CampaignMetrics) => void;
  setPrompt: (prompt: string) => void;
  setGeneratedHtml: (html: string) => void;
  addAsset: (asset: AssetItem) => void;
  removeAsset: (id: string) => void;
  addCampaign: (campaign: CampaignHistoryItem) => void;
  removeCampaign: (id: string) => void;
  setAssets: (assets: AssetItem[]) => void;
  setCampaigns: (campaigns: CampaignHistoryItem[]) => void;
  setTemplates: (templates: EmailTemplate[]) => void;
  addTemplate: (template: EmailTemplate) => void;
  updateTemplate: (template: EmailTemplate) => void;
  removeTemplate: (id: string) => void;
  setSelectedTemplateId: (id: string | null) => void;
};

const initialMetrics: CampaignMetrics = {
  totalLoaded: 0,
  validEmails: 0,
  invalidEmails: 0,
  duplicatesRemoved: 0
};

export const useMailerStore = create<MailerState>((set) => ({
  currentView: "dashboard",
  contacts: [],
  metrics: initialMetrics,
  prompt: "",
  generatedHtml: "<p>La previsualizacion aparecera aqui.</p>",
  assets: [],
  campaigns: [],
  templates: [],
  selectedTemplateId: null,
  setCurrentView: (currentView) => set({ currentView }),
  setContacts: (contacts, metrics) => set({ contacts, metrics }),
  setPrompt: (prompt) => set({ prompt }),
  setGeneratedHtml: (generatedHtml) => set({ generatedHtml }),
  addAsset: (asset) => set((state) => ({ assets: [asset, ...state.assets] })),
  removeAsset: (id) => set((state) => ({ assets: state.assets.filter((a) => a.id !== id) })),
  addCampaign: (campaign) => set((state) => ({ campaigns: [campaign, ...state.campaigns] })),
  removeCampaign: (id) => set((state) => ({ campaigns: state.campaigns.filter((c) => c.id !== id) })),
  setAssets: (assets) => set({ assets }),
  setCampaigns: (campaigns) => set({ campaigns }),
  setTemplates: (templates) => set({ templates }),
  addTemplate: (template) => set((state) => ({ templates: [template, ...state.templates] })),
  updateTemplate: (template) =>
    set((state) => ({ templates: state.templates.map((t) => (t.id === template.id ? template : t)) })),
  removeTemplate: (id) => set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),
  setSelectedTemplateId: (selectedTemplateId) => set({ selectedTemplateId })
}));
