/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  business_name?: string
  caller_name?: string
  caller_phone?: string
  service?: string
  timing?: string
  summary?: string
  transcript_excerpt?: string
  dashboard_link?: string
}

const Email = ({
  business_name = 'your business',
  caller_name = 'Unknown caller',
  caller_phone,
  service,
  timing,
  summary,
  transcript_excerpt,
  dashboard_link = 'https://vektuor.com/dashboard',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New call lead: {caller_name}{caller_phone ? ` (${caller_phone})` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>Vektuor</Text>
        </Section>
        <Heading style={h1}>New call lead</Heading>
        <Text style={text}>Your AI receptionist just captured a new lead for {business_name}.</Text>
        <Section style={card}>
          <Text style={row}><strong>Caller:</strong> {caller_name}</Text>
          {caller_phone ? <Text style={row}><strong>Phone:</strong> {caller_phone}</Text> : null}
          {service ? <Text style={row}><strong>Service:</strong> {service}</Text> : null}
          {timing ? <Text style={row}><strong>Timing:</strong> {timing}</Text> : null}
          {summary ? <Text style={row}><strong>Summary:</strong> {summary}</Text> : null}
        </Section>
        {transcript_excerpt ? (
          <Section style={card}>
            <Text style={rowLabel}>Transcript excerpt</Text>
            <Text style={transcript}>{transcript_excerpt}</Text>
          </Section>
        ) : null}
        <Button style={button} href={dashboard_link}>Open dashboard</Button>
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
  subject: (d: Props) =>
    `New call lead: ${d.caller_name ?? 'Unknown'}${d.business_name ? ` — ${d.business_name}` : ''}`,
  displayName: 'New call lead (owner notification)',
  previewData: {
    business_name: 'Acme HVAC',
    caller_name: 'Jordan Lee',
    caller_phone: '+1 512 555 0142',
    service: 'Heating tune-up',
    timing: 'This week',
    summary: 'Caller wants a heating tune-up before the weekend.',
    transcript_excerpt: 'AI: Thanks for calling Acme HVAC...\nCaller: Hi, my heater is making a noise...',
    dashboard_link: 'https://vektuor.com/dashboard',
  },
} satisfies TemplateEntry<Props>

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '0 24px 24px', maxWidth: '560px' }
const header = { backgroundColor: '#0e1b34', padding: '20px 24px', borderRadius: '12px 12px 0 0', margin: '0 -24px 24px' }
const brand = { color: '#ffffff', fontSize: '18px', fontWeight: 700 as const, margin: 0, letterSpacing: '0.02em' }
const h1 = { fontSize: '22px', fontWeight: 700 as const, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.55', margin: '0 0 14px' }
const card = { backgroundColor: '#f8fafc', borderRadius: '10px', padding: '14px 16px', margin: '8px 0 14px', border: '1px solid #e2e8f0' }
const row = { fontSize: '14px', color: '#0f172a', lineHeight: '1.5', margin: '4px 0' }
const rowLabel = { fontSize: '12px', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 6px' }
const transcript = { fontSize: '13px', color: '#334155', lineHeight: '1.55', margin: 0, whiteSpace: 'pre-wrap' as const, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const button = { backgroundColor: '#1e6fff', color: '#ffffff', fontSize: '14px', borderRadius: '10px', padding: '12px 22px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 18px' }
const footer = { fontSize: '12px', color: '#64748b', margin: '6px 0' }
const link = { color: '#1e6fff', textDecoration: 'none' }