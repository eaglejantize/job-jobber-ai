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
  business_name = 'your business',
  customer_name = 'A new customer',
  customer_phone,
  customer_address,
  service = 'a service appointment',
  when = 'the scheduled time',
  calendar_link,
  notes,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{customer_name} booked {service} on {when}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>Vektuor</Text>
        </Section>
        <Heading style={h1}>New booking on your calendar</Heading>
        <Text style={text}>Your AI receptionist just booked a new appointment for {business_name}.</Text>
        <Section style={card}>
          <Text style={row}><strong>Customer:</strong> {customer_name}</Text>
          {customer_phone ? <Text style={row}><strong>Phone:</strong> {customer_phone}</Text> : null}
          {customer_address ? <Text style={row}><strong>Address:</strong> {customer_address}</Text> : null}
          <Text style={row}><strong>Service:</strong> {service}</Text>
          <Text style={row}><strong>When:</strong> {when}</Text>
          {notes ? <Text style={row}><strong>Notes:</strong> {notes}</Text> : null}
        </Section>
        {calendar_link ? (
          <Button style={button} href={calendar_link}>Open in calendar</Button>
        ) : null}
        <Hr style={hr} />
        <Text style={footer}>
          Sent by <Link href="https://vektuor.com" style={link}>Vektuor</Link>, your AI receptionist.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `New booking: ${d.customer_name ?? 'Customer'} — ${d.when ?? ''}`,
  displayName: 'New booking (owner notification)',
  previewData: {
    business_name: 'Acme HVAC',
    customer_name: 'Jordan Lee',
    customer_phone: '+1 512 555 0142',
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
const card = { backgroundColor: '#f8fafc', borderRadius: '10px', padding: '14px 16px', margin: '8px 0 18px', border: '1px solid #e2e8f0' }
const row = { fontSize: '14px', color: '#0f172a', lineHeight: '1.5', margin: '4px 0' }
const button = { backgroundColor: '#1e6fff', color: '#ffffff', fontSize: '14px', borderRadius: '10px', padding: '12px 22px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 18px' }
const footer = { fontSize: '12px', color: '#64748b', margin: '6px 0' }
const link = { color: '#1e6fff', textDecoration: 'none' }