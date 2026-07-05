import { ComponentType } from "react";
import { BarChart3, Bot, Building2, FlaskConical, Plug, BookOpen, Workflow, Sparkles } from "lucide-react";
import BusinessTab from "./BusinessTab";
import AiReceptionistTab from "./AiReceptionistTab";
import KnowledgeTab from "./KnowledgeTab";
import IntegrationsTab from "./IntegrationsTab";
import IndustryWorkflowTab from "./IndustryWorkflowTab";
import TestingTab from "./TestingTab";
import AnalyticsTab from "./AnalyticsTab";
import AiIntegrationsTab from "./AiIntegrationsTab";
import { UseControlCenterData } from "../useControlCenterData";

export type TabDef = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType<{ ctx: UseControlCenterData }>;
  badge?: string;
};

export const TABS: TabDef[] = [
  { id: "business", label: "Business", icon: Building2, component: BusinessTab },
  { id: "ai", label: "AI Receptionist", icon: Bot, component: AiReceptionistTab },
  { id: "knowledge", label: "Knowledge", icon: BookOpen, component: KnowledgeTab },
  { id: "integrations", label: "Integrations", icon: Plug, component: IntegrationsTab },
  { id: "ai-integrations", label: "AI Integrations", icon: Sparkles, component: AiIntegrationsTab },
  { id: "workflow", label: "Industry Workflow", icon: Workflow, component: IndustryWorkflowTab, badge: "Soon" },
  { id: "testing", label: "Testing", icon: FlaskConical, component: TestingTab },
  { id: "analytics", label: "Analytics", icon: BarChart3, component: AnalyticsTab },
];