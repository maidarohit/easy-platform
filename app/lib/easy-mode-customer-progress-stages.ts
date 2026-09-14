export type EasyModeProgressTask = Readonly<{
  moduleId: string;
  status: string;
  customerState?: "Waiting" | "In progress" | "Completed" | "Failed" | "Needs attention" | "Not needed";
  customerMessage?: string | null;
  canRetry?: boolean;
}>;

export type EasyModeCustomerStageState = "Waiting" | "In progress" | "Completed" | "Failed" | "Needs attention";
export type EasyModeCustomerStageId = "understanding" | "building" | "ready";

export type EasyModeCustomerStage = Readonly<{
  id: EasyModeCustomerStageId;
  badge: "Understanding" | "Building" | "Ready";
  title: string;
  modules: readonly string[];
  status: EasyModeCustomerStageState;
  message: string | null;
  canRetry: boolean;
}>;

const STAGE_DEFINITIONS = [
  {
    id: "understanding",
    badge: "Understanding",
    title: "Understanding your business",
    modules: ["ai-manager", "branding"],
  },
  {
    id: "building",
    badge: "Building",
    title: "Building your online presence",
    modules: ["website"],
  },
  {
    id: "ready",
    badge: "Ready",
    title: "Preparing your business workspace",
    modules: ["marketing", "seo", "uiux", "sales"],
  },
] as const satisfies readonly Readonly<{
  id: EasyModeCustomerStageId;
  badge: EasyModeCustomerStage["badge"];
  title: string;
  modules: readonly string[];
}>[];

type StageSeed = Readonly<{
  id: EasyModeCustomerStageId;
  badge: EasyModeCustomerStage["badge"];
  title: string;
  modules: readonly string[];
  completed: boolean;
  failingState: "Failed" | "Needs attention" | null;
  failureMessage: string | null;
  canRetry: boolean;
  inProgress: boolean;
}>;

function isFailure(task: EasyModeProgressTask) {
  return task.status === "failed" || task.customerState === "Failed" || task.customerState === "Needs attention";
}

function failureState(task: EasyModeProgressTask): "Failed" | "Needs attention" {
  return task.customerState === "Failed" ? "Failed" : "Needs attention";
}

function isInProgress(task: EasyModeProgressTask) {
  return task.status === "running" || task.customerState === "In progress";
}

export function mapEasyModeTasksToCustomerStages(
  tasks: readonly EasyModeProgressTask[],
): readonly EasyModeCustomerStage[] {
  const taskByModule = new Map(tasks.map((task) => [task.moduleId, task] as const));
  const seeds: StageSeed[] = STAGE_DEFINITIONS.map((stage) => {
    const stageTasks = stage.modules.map((moduleId) => taskByModule.get(moduleId)).filter((task) => Boolean(task));
    const failedTask = stageTasks.find((task) => task && isFailure(task));
    return {
      id: stage.id,
      badge: stage.badge,
      title: stage.title,
      modules: stage.modules,
      completed: stageTasks.length === stage.modules.length && stageTasks.every((task) => task?.status === "completed"),
      failingState: failedTask ? failureState(failedTask) : null,
      failureMessage: failedTask?.customerMessage ?? null,
      canRetry: stageTasks.some((task) => task?.canRetry === true),
      inProgress: stageTasks.some((task) => task && isInProgress(task)),
    };
  });

  const activeIndex = seeds.findIndex((stage) => !stage.completed && !stage.failingState);

  return seeds.map((stage, index) => {
    const status: EasyModeCustomerStageState = stage.completed
      ? "Completed"
      : stage.failingState
        ? stage.failingState
        : stage.inProgress || index === activeIndex
          ? "In progress"
          : "Waiting";
    return Object.freeze({
      id: stage.id,
      badge: stage.badge,
      title: stage.title,
      modules: stage.modules,
      status,
      message: stage.failingState ? stage.failureMessage : null,
      canRetry: stage.canRetry,
    });
  });
}

export function findEasyModeAttentionStage(
  stages: readonly EasyModeCustomerStage[],
): EasyModeCustomerStage | null {
  return stages.find((stage) => stage.status === "Failed" || stage.status === "Needs attention") ?? null;
}
