import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import { deleteAsset, deleteCampaign, listAssets, listCampaigns, listTemplates, saveTemplate } from "./lib/db";
import { BASE_TEMPLATES } from "./data/baseTemplates";
import TemplatesLibraryView from "./views/TemplatesLibraryView";
import TemplateEditorView from "./views/TemplateEditorView";
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
    metrics,
    assets,
    templates,
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
    setSelectedTemplateId
  } = useMailerStore();

  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateRetry, setTemplateRetry] = useState(0);

  useEffect(() => {
    async function syncCampaignsAndAssets() {
      if (!hasSupabaseConfig) return;
      try {
        const [campaignRows, assetRows] = await Promise.all([listCampaigns(), listAssets()]);
        setCampaigns(campaignRows);
        setAssets(assetRows);
      } catch (error) {
        console.error("Error sincronizando campañas/activos:", error);
      }
    }
    void syncCampaignsAndAssets();
  }, [setAssets, setCampaigns]);

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

  return (
    <Layout view={currentView} onChangeView={setCurrentView}>
      {currentView === "dashboard" && (
        <DashboardView
          campaigns={campaigns}
          metrics={metrics}
          onDeleteCampaign={async (id) => {
            await deleteCampaign(id);
            removeCampaign(id);
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
          loading={templateLoading}
          error={templateError}
          onRetry={() => setTemplateRetry((n) => n + 1)}
          onEdit={(id) => {
            setSelectedTemplateId(id);
            setCurrentView("template-editor");
          }}
          onNew={() => {
            setSelectedTemplateId(null);
            setCurrentView("template-editor");
          }}
        />
      )}
      {currentView === "template-editor" && (
        <TemplateEditorView
          key={selectedTemplateId ?? "new"}
          initialTemplate={templates.find((t) => t.id === selectedTemplateId) ?? null}
          onSaved={(template) => {
            if (selectedTemplateId) {
              updateTemplate(template);
            } else {
              addTemplate(template);
            }
            setSelectedTemplateId(template.id);
            setCurrentView("templates");
          }}
          onDeleted={() => {
            if (selectedTemplateId) removeTemplate(selectedTemplateId);
            setSelectedTemplateId(null);
            setCurrentView("templates");
          }}
          onCancel={() => setCurrentView("templates")}
        />
      )}
    </Layout>
  );
}
