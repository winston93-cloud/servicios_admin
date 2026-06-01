import { manejarPostWebhookOpenpay } from '@/lib/openpayWebhookRouteHandler'

export const runtime = 'nodejs'

/** Webhook OpenPay — plantel Educativo / Maternal-Kinder (nivel < 3). */
export async function POST(request: Request) {
  return manejarPostWebhookOpenpay(request, 'educativo')
}
