export const dynamic = 'force-dynamic';

function reject() {
  return new Response('Bad Request', { status: 400 });
}

export function GET() { return reject(); }
export function POST() { return reject(); }
export function HEAD() { return reject(); }