import { create } from "zustand";
import type {
  AppView,
  AssetItem,
  CampaignHistoryItem,
  EmailTemplate,
  Project,
  WhatsAppCampaignItem,
  WhatsAppTemplate
} from "../types";

type MailerState = {
  currentView: AppView;
  assets: AssetItem[];
  campaigns: CampaignHistoryItem[];
  templates: EmailTemplate[];
  projects: Project[];
  whatsappTemplates: WhatsAppTemplate[];
  whatsappCampaigns: WhatsAppCampaignItem[];
  selectedTemplateId: string | null;
  selectedWhatsAppTemplateId: string | null;
  setCurrentView: (view: AppView) => void;
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
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setWhatsappTemplates: (templates: WhatsAppTemplate[]) => void;
  addWhatsappTemplate: (template: WhatsAppTemplate) => void;
  updateWhatsappTemplate: (template: WhatsAppTemplate) => void;
  removeWhatsappTemplate: (id: string) => void;
  setWhatsappCampaigns: (campaigns: WhatsAppCampaignItem[]) => void;
  addWhatsappCampaign: (campaign: WhatsAppCampaignItem) => void;
  removeWhatsappCampaign: (id: string) => void;
  setSelectedTemplateId: (id: string | null) => void;
  setSelectedWhatsAppTemplateId: (id: string | null) => void;
};

export const useMailerStore = create<MailerState>((set) => ({
  currentView: "dashboard",
  assets: [],
  campaigns: [],
  templates: [],
  projects: [],
  whatsappTemplates: [],
  whatsappCampaigns: [],
  selectedTemplateId: null,
  selectedWhatsAppTemplateId: null,
  setCurrentView: (currentView) => set({ currentView }),
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
  setProjects: (projects) => set({ projects }),
  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project].sort((a, b) => a.name.localeCompare(b.name)) })),
  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      // Las plantillas del proyecto borrado pasan a General (project_id = null).
      templates: state.templates.map((t) => (t.projectId === id ? { ...t, projectId: null } : t))
    })),
  setWhatsappTemplates: (whatsappTemplates) => set({ whatsappTemplates }),
  addWhatsappTemplate: (template) =>
    set((state) => ({ whatsappTemplates: [template, ...state.whatsappTemplates] })),
  updateWhatsappTemplate: (template) =>
    set((state) => ({
      whatsappTemplates: state.whatsappTemplates.map((t) => (t.id === template.id ? template : t))
    })),
  removeWhatsappTemplate: (id) =>
    set((state) => ({ whatsappTemplates: state.whatsappTemplates.filter((t) => t.id !== id) })),
  setWhatsappCampaigns: (whatsappCampaigns) => set({ whatsappCampaigns }),
  addWhatsappCampaign: (campaign) =>
    set((state) => ({ whatsappCampaigns: [campaign, ...state.whatsappCampaigns] })),
  removeWhatsappCampaign: (id) =>
    set((state) => ({ whatsappCampaigns: state.whatsappCampaigns.filter((c) => c.id !== id) })),
  setSelectedTemplateId: (selectedTemplateId) => set({ selectedTemplateId }),
  setSelectedWhatsAppTemplateId: (selectedWhatsAppTemplateId) => set({ selectedWhatsAppTemplateId })
}));
