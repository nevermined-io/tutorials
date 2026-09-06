import Chat from './chat'
import { PACKAGES } from '@/lib/packages'

// Server component: read the embed origin from server env and hand it to the
// client. Kept out of NEXT_PUBLIC_* on purpose — the browser gets it as a prop,
// and the message listener uses the exact same value to check event.origin.
export default function Page() {
  const embedBase = process.env.NVM_EMBED_BASE_URL ?? 'http://localhost:4250'
  return <Chat embedBase={embedBase} packages={PACKAGES} />
}
