import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import { createProject, deleteAsset, deleteCampaign, deleteWhatsAppCampaign, listAssets, listCampaigns, listProjects, listTemplates, listWhatsAppCampaigns, listWhatsAppTemplates, saveTemplate, setTemplateProject } from "./lib/db";
import { dispatchNextBatch } from "./lib/dispatch";
import { BASE_TEMPLATES } from "./data/baseTemplates";
import TemplatesLibraryView from "./views/TemplatesLibraryView";
import TemplateEditorView from "./views/TemplateEditorView";
import WhatsAppTemplatesView from "./views/WhatsAppTemplatesView";
import WhatsAppTemplateEditorView from "./views/WhatsAppTemplateEditorView";
import WhatsAppSendView from "./views/WhatsAppSendView";
import { hasSupabaseConfig } from "./lib/supabase";
import { useMailerStore } from "./store/useMailerStore";
import DashboardView from "./views/DashboardView";
import CampaignCreatorView from "./views/CampaignCreatorView";
import AssetLibraryView from "./views/AssetLibraryView";

export default function App() {
  const {
    currentView,
    setCurrentView,
    campaigns,
    assets,
    templates,
    projects,
    selectedTemplateId,
    addAsset,
    removeAsset,
    addCampaign,
    removeCampaign,
    setAssets,
    setCampaigns,
    setTemplates,
    addTemplate,
    updateTemplate,
    removeTemplate,
    setProjects,
    addProject,
    setSelectedTemplateId,
    whatsappTemplates,
    whatsappCampaigns,
    selectedWhatsAppTemplateId,
    setWhatsappTemplates,
    setWhatsappCampaigns,
    addWhatsappCampaign,
    removeWhatsappCampaign,
    addWhatsappTemplate,
    updateWhatsappTemplate,
    removeWhatsappTemplate,
    setSelectedWhatsAppTemplateId
  } = useMailerStore();

  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateRetry, setTemplateRetry] = useState(0);
  const [aiDraft, setAiDraft] = useState<{ html: string; projectId: string | null } | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(true);
  const [waRetry, setWaRetry] = useState(0);

  useEffect(() => {
    async function syncCampaignsAndAssets() {
      if (!hasSupabaseConfig) return;
      try {
        const [campaignRows, assetRows, projectRows] = await Promise.all([
          listCampaigns(),
          listAssets(),
          listProjects()
        ]);
        setCampaigns(campaignRows);
        setAssets(assetRows);
        setProjects(projectRows);
      } catch (error) {
        console.error("Error sincronizando campañas/activos/proyectos:", error);
      }
      // Aparte: si la tabla whatsapp_campaigns aún no existe (migración 0004), no rompe el resto.
      try {
        setWhatsappCampaigns(await listWhatsAppCampaigns());
      } catch (error) {
        console.error("Error sincronizando envíos WhatsApp (¿migración 0004 corrida?):", error);
      }
    }
    void syncCampaignsAndAssets();
  }, [setAssets, setCampaigns, setProjects, setWhatsappCampaigns]);

  async function handleCreateProject(name: string) {
    const project = await createProject(name);
    addProject(project);
    return project;
  }

  async function handleAssignProject(templateId: string, projectId: string | null) {
    const updated = await setTemplateProject(templateId, projectId);
    updateTemplate(updated);
    return updated;
  }

  useEffect(() => {
    async function loadTemplates() {
      if (!hasSupabaseConfig) {
        setTemplateError("Supabase no está configurado. Revisá las variables de entorno (.env).");
        setTemplateLoading(false);
        return;
      }
      setTemplateError(null);
      setTemplateLoading(true);
      try {
        const templateRows = await listTemplates();
        if (templateRows.length === 0) {
          const seeded: typeof templateRows = [];
          let firstSeedError: string | null = null;
          for (const t of BASE_TEMPLATES) {
            try {
              const result = await saveTemplate(t);
              seeded.push(result);
            } catch (seedError) {
              const msg = seedError instanceof Error ? seedError.message : String(seedError);
              if (!firstSeedError) firstSeedError = msg;
              console.error(`Error sembrando plantilla "${t.name}":`, seedError);
            }
          }
          if (seeded.length === 0) {
            throw new Error(
              firstSeedError
                ? `Error al insertar plantillas: ${firstSeedError}`
                : "No se pudo insertar ninguna plantilla. Verificá que la tabla exista y que RLS esté deshabilitado."
            );
          }
          setTemplates(seeded);
        } else {
          setTemplates(templateRows);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido al cargar plantillas.";
        console.error("Error cargando plantillas:", error);
        setTemplateError(msg);
      } finally {
        setTemplateLoading(false);
      }
    }
    void loadTemplates();
  }, [setTemplates, templateRetry]);

  useEffect(() => {
    async function loadWhatsappTemplates() {
      if (!hasSupabaseConfig) {
        setWaError("Supabase no está configurado. Revisá las variables de entorno (.env).");
        setWaLoading(false);
        return;
      }
      setWaError(null);
      setWaLoading(true);
      try {
        setWhatsappTemplates(await listWhatsAppTemplates());
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido al cargar plantillas de WhatsApp.";
        console.error("Error cargando plantillas WhatsApp:", error);
        setWaError(msg);
      } finally {
        setWaLoading(false);
      }
    }
    void loadWhatsappTemplates();
  }, [setWhatsappTemplates, waRetry]);

  return (
    <Layout view={currentView} onChangeView={setCurrentView}>
      {currentView === "dashboard" && (
        <DashboardView
          campaigns={campaigns}
          whatsappCampaigns={whatsappCampaigns}
          onDeleteCampaign={async (id) => {
            await deleteCampaign(id);
            removeCampaign(id);
          }}
          onDeleteWhatsAppCampaign={async (id) => {
            await deleteWhatsAppCampaign(id);
            removeWhatsappCampaign(id);
          }}
          onDispatchBatch={async (id) => {
            try {
              return await dispatchNextBatch(id);
            } finally {
              // Refresca estados/pendientes aunque el lote haya fallado.
              setCampaigns(await listCampaigns());
            }
          }}
          onRefresh={async () => {
            setCampaigns(await listCampaigns());
            try {
              setWhatsappCampaigns(await listWhatsAppCampaigns());
            } catch (error) {
              console.error("Error actualizando envíos WhatsApp (¿migración 0004 corrida?):", error);
            }
          }}
        />
      )}
      {currentView === "campaign" && (
        <CampaignCreatorView
          templates={templates}
          initialTemplateId={selectedTemplateId}
          onCampaignCreated={(campaign) => {
            addCampaign(campaign);
            setCurrentView("dashboard");
          }}
        />
      )}
      {currentView === "assets" && (
        <AssetLibraryView
          assets={assets}
          onAssetCreated={addAsset}
          onAssetDeleted={async (id) => {
            await deleteAsset(id);
            removeAsset(id);
          }}
        />
      )}
      {currentView === "templates" && (
        <TemplatesLibraryView
          templates={templates}
          projects={projects}
          assets={assets}
          loading={templateLoading}
          error={templateError}
          onRetry={() => setTemplateRetry((n) => n + 1)}
          onAssignProject={handleAssignProject}
          onAiDraftReady={(draft) => {
            setAiDraft(draft);
            setSelectedTemplateId(null);
            setCurrentView("template-editor");
          }}
          onEdit={(id) => {
            setAiDraft(null);
            setSelectedTemplateId(id);
            setCurrentView("template-editor");
          }}
          onNew={() => {
            setAiDraft(null);
            setSelectedTemplateId(null);
            setCurrentView("template-editor");
          }}
        />
      )}
      {currentView === "template-editor" && (
        <TemplateEditorView
          key={selectedTemplateId ?? (aiDraft ? "ai-draft" : "new")}
          initialTemplate={templates.find((t) => t.id === selectedTemplateId) ?? null}
          templates={templates}
          projects={projects}
          assets={assets}
          initialDraft={selectedTemplateId ? null : aiDraft}
          onCreateProject={handleCreateProject}
          onSaved={(template) => {
            if (selectedTemplateId) {
              updateTemplate(template);
            } else {
              addTemplate(template);
            }
            setAiDraft(null);
            setSelectedTemplateId(template.id);
            setCurrentView("templates");
          }}
          onDeleted={() => {
            if (selectedTemplateId) removeTemplate(selectedTemplateId);
            setAiDraft(null);
            setSelectedTemplateId(null);
            setCurrentView("templates");
          }}
          onCancel={() => {
            setAiDraft(null);
            setCurrentView("templates");
          }}
        />
      )}
      {currentView === "whatsapp-templates" && (
        <WhatsAppTemplatesView
          templates={whatsappTemplates}
          loading={waLoading}
          error={waError}
          onRetry={() => setWaRetry((n) => n + 1)}
          onEdit={(id) => {
            setSelectedWhatsAppTemplateId(id);
            setCurrentView("whatsapp-template-editor");
          }}
          onNew={() => {
            setSelectedWhatsAppTemplateId(null);
            setCurrentView("whatsapp-template-editor");
          }}
        />
      )}
      {currentView === "whatsapp-template-editor" && (
        <WhatsAppTemplateEditorView
          key={selectedWhatsAppTemplateId ?? "new"}
          initialTemplate={whatsappTemplates.find((t) => t.id === selectedWhatsAppTemplateId) ?? null}
          onSaved={(template) => {
            if (selectedWhatsAppTemplateId) {
              updateWhatsappTemplate(template);
            } else {
              addWhatsappTemplate(template);
            }
            setSelectedWhatsAppTemplateId(template.id);
            setCurrentView("whatsapp-templates");
          }}
          onDeleted={() => {
            if (selectedWhatsAppTemplateId) removeWhatsappTemplate(selectedWhatsAppTemplateId);
            setSelectedWhatsAppTemplateId(null);
            setCurrentView("whatsapp-templates");
          }}
          onCancel={() => setCurrentView("whatsapp-templates")}
        />
      )}
      {currentView === "whatsapp-send" && (
        <WhatsAppSendView
          templates={whatsappTemplates}
          onManageTemplates={() => setCurrentView("whatsapp-templates")}
          onCampaignCreated={(campaign) => {
            addWhatsappCampaign(campaign);
            setCurrentView("dashboard");
          }}
        />
      )}
    </Layout>
  );
}
