import { useEffect, useState } from "react";
import { Loader2, Plus, Edit2, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type IndustryDefinition = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  aliases: string[];
  industry_values: string[];
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type IndustryWorkflow = {
  id: string;
  industry_definition_id: string;
  workflow_key: string;
  workflow_name: string;
  is_default: boolean;
  is_active: boolean;
  default_services: string[];
  intake_questions: string[];
  ai_prompts: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export default function IndustryConfigManager() {
  const [definitions, setDefinitions] = useState<IndustryDefinition[]>([]);
  const [selectedDef, setSelectedDef] = useState<IndustryDefinition | null>(null);
  const [workflows, setWorkflows] = useState<IndustryWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDefDialog, setShowDefDialog] = useState(false);
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [editingDef, setEditingDef] = useState<IndustryDefinition | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<IndustryWorkflow | null>(null);

  // Form states
  const [defForm, setDefForm] = useState({
    key: "",
    label: "",
    description: "",
    aliases: "",
    industry_values: "",
    is_active: true,
    is_default: false,
    sort_order: 0,
  });

  const [workflowForm, setWorkflowForm] = useState({
    workflow_key: "",
    workflow_name: "",
    is_active: true,
    is_default: false,
    default_services: "",
    intake_questions: "",
  });

  async function loadDefinitions() {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("callcapture_industry_definitions")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setDefinitions((data as unknown as IndustryDefinition[]) ?? []);
      if (!selectedDef && data && data.length > 0) {
        setSelectedDef(data[0] as unknown as IndustryDefinition);
      }
    } catch (err) {
      toast({
        title: "Failed to load definitions",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkflows(defId: string) {
    try {
      const { data, error } = await (supabase as any)
        .from("callcapture_industry_workflows")
        .select("*")
        .eq("industry_definition_id", defId)
        .order("is_default", { ascending: false });

      if (error) throw error;
      setWorkflows((data as unknown as IndustryWorkflow[]) ?? []);
    } catch (err) {
      toast({
        title: "Failed to load workflows",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    void loadDefinitions();
  }, []);

  useEffect(() => {
    if (selectedDef) {
      void loadWorkflows(selectedDef.id);
    }
  }, [selectedDef]);

  function openDefDialog(def?: IndustryDefinition) {
    if (def) {
      setEditingDef(def);
      setDefForm({
        key: def.key,
        label: def.label,
        description: def.description ?? "",
        aliases: def.aliases.join(", "),
        industry_values: def.industry_values.join(", "),
        is_active: def.is_active,
        is_default: def.is_default,
        sort_order: def.sort_order,
      });
    } else {
      setEditingDef(null);
      setDefForm({
        key: "",
        label: "",
        description: "",
        aliases: "",
        industry_values: "",
        is_active: true,
        is_default: false,
        sort_order: 0,
      });
    }
    setShowDefDialog(true);
  }

  async function saveDefinition() {
    if (!defForm.key || !defForm.label) {
      toast({
        title: "Validation error",
        description: "Key and label are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        key: defForm.key,
        label: defForm.label,
        description: defForm.description || null,
        aliases: defForm.aliases.split(",").map((s) => s.trim()).filter(Boolean),
        industry_values: defForm.industry_values.split(",").map((s) => s.trim()).filter(Boolean),
        is_active: defForm.is_active,
        is_default: defForm.is_default,
        sort_order: defForm.sort_order,
      };

      const { data, error } = editingDef
        ? await (supabase as any)
            .from("callcapture_industry_definitions")
            .update(payload)
            .eq("id", editingDef.id)
            .select()
            .single()
        : await (supabase as any).from("callcapture_industry_definitions").insert(payload).select().single();

      if (error) throw error;

      toast({
        title: "Success",
        description: editingDef ? "Definition updated" : "Definition created",
      });

      setShowDefDialog(false);
      await loadDefinitions();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  function openWorkflowDialog(workflow?: IndustryWorkflow) {
    if (workflow) {
      setEditingWorkflow(workflow);
      setWorkflowForm({
        workflow_key: workflow.workflow_key,
        workflow_name: workflow.workflow_name,
        is_active: workflow.is_active,
        is_default: workflow.is_default,
        default_services: workflow.default_services.join(", "),
        intake_questions: workflow.intake_questions.join(", "),
      });
    } else {
      setEditingWorkflow(null);
      setWorkflowForm({
        workflow_key: "",
        workflow_name: "",
        is_active: true,
        is_default: false,
        default_services: "",
        intake_questions: "",
      });
    }
    setShowWorkflowDialog(true);
  }

  async function saveWorkflow() {
    if (!selectedDef) return;
    if (!workflowForm.workflow_key || !workflowForm.workflow_name) {
      toast({
        title: "Validation error",
        description: "Key and name are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        industry_definition_id: selectedDef.id,
        workflow_key: workflowForm.workflow_key,
        workflow_name: workflowForm.workflow_name,
        is_active: workflowForm.is_active,
        is_default: workflowForm.is_default,
        default_services: workflowForm.default_services.split(",").map((s) => s.trim()).filter(Boolean),
        intake_questions: workflowForm.intake_questions.split(",").map((s) => s.trim()).filter(Boolean),
        ai_prompts: { system_prompt_template: "service_receptionist" },
        terminology: [],
        workflows: [],
        templates: [],
        knowledge_base: [],
        automations: [],
        metadata: {},
      };

      const { error } = editingWorkflow
        ? await (supabase as any)
            .from("callcapture_industry_workflows")
            .update(payload)
            .eq("id", editingWorkflow.id)
        : await (supabase as any).from("callcapture_industry_workflows").insert(payload);

      if (error) throw error;

      toast({
        title: "Success",
        description: editingWorkflow ? "Workflow updated" : "Workflow created",
      });

      setShowWorkflowDialog(false);
      await loadWorkflows(selectedDef.id);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading industry configs...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Definitions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Industry Definitions</h2>
          <Button onClick={() => openDefDialog()} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1" /> New Definition
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {definitions.length === 0 ? (
            <div className="text-slate-400 py-8 text-center">No industry definitions</div>
          ) : (
            definitions.map((def) => (
              <div
                key={def.id}
                onClick={() => setSelectedDef(def)}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedDef?.id === def.id
                    ? "bg-slate-900 border-emerald-500"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{def.label}</h3>
                    <p className="text-sm text-slate-400">{def.key}</p>
                    {def.description && <p className="text-sm text-slate-300 mt-1">{def.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {def.is_default && <span className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-1 rounded">Default</span>}
                    {!def.is_active && <span className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">Inactive</span>}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDefDialog(def);
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Workflows Section */}
      {selectedDef && (
        <div className="space-y-4 border-t border-slate-700 pt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Workflows for {selectedDef.label}</h2>
            <Button onClick={() => openWorkflowDialog()} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> New Workflow
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {workflows.length === 0 ? (
              <div className="text-slate-400 py-8 text-center">No workflows configured</div>
            ) : (
              workflows.map((wf) => (
                <div key={wf.id} className="p-4 rounded-lg bg-slate-800 border border-slate-700 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{wf.workflow_name}</h3>
                      <p className="text-sm text-slate-400">{wf.workflow_key}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {wf.is_default && <span className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-1 rounded">Default</span>}
                      {!wf.is_active && <span className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">Inactive</span>}
                      <Button
                        onClick={() => openWorkflowDialog(wf)}
                        size="sm"
                        variant="ghost"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-slate-400">
                    <p>Services: {wf.default_services.join(", ") || "None"}</p>
                    <p>Questions: {wf.intake_questions.length}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Definition Dialog */}
      <Dialog open={showDefDialog} onOpenChange={setShowDefDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle>{editingDef ? "Edit Definition" : "Create Definition"}</DialogTitle>
            <DialogDescription>
              Define industry configuration and metadata
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="def-key" className="text-slate-300">Key (slug)</Label>
              <Input
                id="def-key"
                value={defForm.key}
                onChange={(e) => setDefForm({ ...defForm, key: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                disabled={!!editingDef}
              />
            </div>
            <div>
              <Label htmlFor="def-label" className="text-slate-300">Label</Label>
              <Input
                id="def-label"
                value={defForm.label}
                onChange={(e) => setDefForm({ ...defForm, label: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label htmlFor="def-desc" className="text-slate-300">Description</Label>
              <Textarea
                id="def-desc"
                value={defForm.description}
                onChange={(e) => setDefForm({ ...defForm, description: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300 block mb-2">Active</Label>
                <Switch checked={defForm.is_active} onCheckedChange={(v) => setDefForm({ ...defForm, is_active: v })} />
              </div>
              <div>
                <Label className="text-slate-300 block mb-2">Default</Label>
                <Switch checked={defForm.is_default} onCheckedChange={(v) => setDefForm({ ...defForm, is_default: v })} />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={saveDefinition} className="bg-emerald-600 hover:bg-emerald-700 flex-1">
                Save
              </Button>
              <Button onClick={() => setShowDefDialog(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workflow Dialog */}
      <Dialog open={showWorkflowDialog} onOpenChange={setShowWorkflowDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingWorkflow ? "Edit Workflow" : "Create Workflow"}</DialogTitle>
            <DialogDescription>
              Configure workflow for {selectedDef?.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wf-key" className="text-slate-300">Workflow Key</Label>
              <Input
                id="wf-key"
                value={workflowForm.workflow_key}
                onChange={(e) => setWorkflowForm({ ...workflowForm, workflow_key: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                disabled={!!editingWorkflow}
              />
            </div>
            <div>
              <Label htmlFor="wf-name" className="text-slate-300">Workflow Name</Label>
              <Input
                id="wf-name"
                value={workflowForm.workflow_name}
                onChange={(e) => setWorkflowForm({ ...workflowForm, workflow_name: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label htmlFor="wf-services" className="text-slate-300">Default Services (comma-separated)</Label>
              <Input
                id="wf-services"
                value={workflowForm.default_services}
                onChange={(e) => setWorkflowForm({ ...workflowForm, default_services: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="e.g., Repair, Installation, Maintenance"
              />
            </div>
            <div>
              <Label htmlFor="wf-questions" className="text-slate-300">Intake Questions (comma-separated)</Label>
              <Textarea
                id="wf-questions"
                value={workflowForm.intake_questions}
                onChange={(e) => setWorkflowForm({ ...workflowForm, intake_questions: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                rows={3}
                placeholder="e.g., Service address, Issue / problem, Urgency"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300 block mb-2">Active</Label>
                <Switch checked={workflowForm.is_active} onCheckedChange={(v) => setWorkflowForm({ ...workflowForm, is_active: v })} />
              </div>
              <div>
                <Label className="text-slate-300 block mb-2">Default Workflow</Label>
                <Switch checked={workflowForm.is_default} onCheckedChange={(v) => setWorkflowForm({ ...workflowForm, is_default: v })} />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={saveWorkflow} className="bg-emerald-600 hover:bg-emerald-700 flex-1">
                Save
              </Button>
              <Button onClick={() => setShowWorkflowDialog(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
