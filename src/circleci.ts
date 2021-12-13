export interface WebHook {
  id: string
  name: string
}

export interface Project {
  id: string
  name: string
  slug: string
}

export interface Organization {
  id: string
  name: string
}

export type WorkflowStatus =
  | 'success'
  | 'failed'
  | 'error'
  | 'canceled'
  | 'unauthorized'

export interface Workflow {
  id: string
  name: string
  created_at: string
  stopped_at?: string
  url: string
  status?: WorkflowStatus
}

export type PipelineTriggerType = 'webhook' | 'api' | 'schedule'

export interface Pipeline {
  id: string
  number: number
  created_at: string
  trigger: {
    type: PipelineTriggerType
  }
  vcs?: VCS
}

export interface VCS {
  origin_repository_url?: string
  target_repository_url?: string
  revision?: string
  commit?: {
    subject?: string
    body?: string
    author?: {
      name?: string
      email?: string
    }
    authored_at?: string
    committer?: {
      name?: string
      email?: string
    }
    committed_at?: string
  }
  branch?: string
  tag?: string
}

export interface WebHookWorkflowCompletedPayload {
  id: string
  type: 'workflow-completed'
  happened_at: string
  webhook: WebHook
  project: Project
  organization: Organization
  workflow: Workflow
  pipeline: Pipeline
}
