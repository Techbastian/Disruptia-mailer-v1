import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type {
  AppView,
  AssetItem,
  CampaignHistoryItem,
  CampaignMetrics,
  ContactRecord,
  EmailTemplate,
  Project,
  WhatsAppCampaignItem,
  WhatsAppTemplate
} from "../types";
import type { InvalidRow } from "../lib/csv";

// ── Borrador de campaña en edición ────────────────────────────────────────────
// Vive en el store (navegar entre pantallas no lo pierde) y se persiste en
// localStorage (recargar la pestaña tampoco). Se limpia al enviar o cancelar.

export type CampaignDraft = {
  step: number;
  contacts: ContactRecord[];
  metrics: CampaignMetrics | null;
  columnNames: string[];
  invalidRows: InvalidRow[];
  selectedTemplateId: string | null;
  campaignVars: Record<string, string>;
  subject: string;
  title: string;
  // true si la lista era muy grande para localStorage y no sobrevivió la recarga.
  contactsDropped: boolean;
};

export const EMPTY_CAMPAIGN_DRAFT: CampaignDraft = {
  step: 1,
  contacts: [],
  metrics: null,
  columnNames: [],
  invalidRows: [],
  selectedTemplateId: null,
  campaignVars: {},
  subject: "",
  title: "",
  contactsDropped: false
};

export function isDraftActive(draft: CampaignDraft): boolean {
  return (
    draft.contacts.length > 0 ||
    draft.contactsDropped ||
    draft.selectedTemplateId !== null ||
    draft.subject.trim() !== "" ||
    draft.title.trim() !== ""
  );
}

// localStorage con guard de cuota: si la lista de contactos no cabe, se
// persiste el borrador sin la lista (contactsDropped avisa al usuario).
const draftStorage: StateStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      try {
        const parsed = JSON.parse(value);
        const draft = parsed?.state?.campaignDraft;
        if (draft && Array.isArray(draft.contacts) && draft.contacts.length > 0) {
          draft.contacts = [];
          draft.contactsDropped = true;
          localStorage.setItem(key, JSON.stringify(parsed));
        }
      } catch {
        // Sin espacio ni siquiera para el borrador liviano: no persiste.
      }
    }
  },
  removeItem: (key) => localStorage.removeItem(key)
};

type MailerState = {
  currentView: AppView;
  assets: AssetItem[];
  campaigns: CampaignHistoryItem[];
  templates: EmailTemplate[];
  projects: Project[];
  whatsappTemplates: WhatsAppTemplate[];
  whatsappCampaigns: WhatsAppCampaignItem[];
  campaignDraft: CampaignDraft;
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
  updateCampaignDraft: (patch: Partial<CampaignDraft>) => void;
  resetCampaignDraft: () => void;
  setSelectedTemplateId: (id: string | null) => void;
  setSelectedWhatsAppTemplateId: (id: string | null) => void;
};

export const useMailerStore = create<MailerState>()(
  persist(
    (set) => ({
  currentView: "dashboard",
  assets: [],
  campaigns: [],
  templates: [],
  projects: [],
  whatsappTemplates: [],
  whatsappCampaigns: [],
  campaignDraft: EMPTY_CAMPAIGN_DRAFT,
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
  updateCampaignDraft: (patch) =>
    set((state) => ({ campaignDraft: { ...state.campaignDraft, ...patch } })),
  resetCampaignDraft: () => set({ campaignDraft: EMPTY_CAMPAIGN_DRAFT }),
  setSelectedTemplateId: (selectedTemplateId) => set({ selectedTemplateId }),
  setSelectedWhatsAppTemplateId: (selectedWhatsAppTemplateId) => set({ selectedWhatsAppTemplateId })
    }),
    {
      name: "disruptia-mailer-draft",
      storage: createJSONStorage(() => draftStorage),
      // Solo el borrador de campaña se persiste; el resto se recarga de Supabase.
      partialize: (state) => ({ campaignDraft: state.campaignDraft })
    }
  )
);
