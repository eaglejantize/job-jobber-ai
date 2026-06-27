/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  business_name?: string
  customer_name?: string
  customer_phone?: string
  customer_address?: string
  service?: string
  when?: string
  calendar_link?: string
  notes?: string
}

const Email = ({
  business_name = 'our team',
  customer_name = 'there',
  customer_address,
  service = 'your appointment',
  when = 'the scheduled time',
  calendar_link,
  notes,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your appointment with {business_name} is confirmed for {when}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>Vektuor</Text>
        </Section>
        <Heading style={h1}>Your appointment is confirmed</Heading>
        <Text style={text}>Hi {customer_name},</Text>
        <Text style={text}>
          This confirms your <strong>{service}</strong> with <strong>{business_name}</strong>{' '}
          on <strong>{when}</strong>.
        </Text>
        {customer_address ? (
          <Text style={text}>Location on file: {customer_address}</Text>
        ) : null}
        {notes ? <Text style={text}>Notes: {notes}</Text> : null}
        {calendar_link ? (
          <Button style={button} href={calendar_link}>Add to calendar</Button>
        ) : null}
        <Hr style={hr} />
        <Text style={footer}>
          If anything changes, just reply to this email or call {business_name}.
        </Text>
        <Text style={footer}>
          Sent by <Link href="https://vektuor.com" style={link}>Vektuor</Link> on behalf of {business_name}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Your appointment with ${d.business_name ?? 'us'} is confirmed`,
  displayName: 'Appointment confirmation (customer)',
  previewData: {
    business_name: 'Acme HVAC',
    customer_name: 'Jordan',
    customer_address: '123 Main St, Austin TX',
    service: 'Heating tune-up',
    when: 'Tuesday, Sep 9 at 10:00 AM',
    calendar_link: 'https://calendar.google.com/event?eid=demo',
    notes: 'Gate code 4521',
  },
} satisfies TemplateEntry<Props>

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '0 24px 24px', maxWidth: '560px' }
const header = { backgroundColor: '#0e1b34', padding: '20px 24px', borderRadius: '12px 12px 0 0', margin: '0 -24px 24px' }
const brand = { color: '#ffffff', fontSize: '18px', fontWeight: 700 as const, margin: 0, letterSpacing: '0.02em' }
const h1 = { fontSize: '22px', fontWeight: 700 as const, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.55', margin: '0 0 14px' }
const button = { backgroundColor: '#1e6fff', color: '#ffffff', fontSize: '14px', borderRadius: '10px', padding: '12px 22px', textDecoration: 'none', display: 'inline-block', marginTop: '8px' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 18px' }
const footer = { fontSize: '12px', color: '#64748b', margin: '6px 0' }
const link = { color: '#1e6fff', textDecoration: 'none' }