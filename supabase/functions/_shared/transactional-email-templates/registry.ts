/// <reference types="npm:@types/react@18.3.1" />

import type { ComponentType } from 'npm:react@18.3.1'
import { template as appointmentCustomer } from './appointment-confirmation-customer.tsx'
import { template as appointmentOwner } from './appointment-notification-owner.tsx'
import { template as newLeadOwner } from './new-lead-owner.tsx'

export interface TemplateEntry<P = Record<string, unknown>> {
  component: ComponentType<P>
  subject: string | ((data: P) => string)
  displayName?: string
  previewData?: P
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry<any>> = {
  'appointment-confirmation-customer': appointmentCustomer,
  'appointment-notification-owner': appointmentOwner,
  'new-lead-owner': newLeadOwner,
}