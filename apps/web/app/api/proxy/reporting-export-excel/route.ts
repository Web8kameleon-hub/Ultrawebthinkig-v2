import { NextResponse } from 'next/server';
import { fetchArrayBufferFromCandidates } from "../../_lib/upstream";

// Generate filename with date and time to avoid conflicts
function generateFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `clisonix-report-${year}${month}${day}-${hours}${minutes}${seconds}.xlsx`;
}

export async function GET() {
  try {
    const { data: buffer } = await fetchArrayBufferFromCandidates({
      group: "reporting",
      path: "/api/reporting/export?format=xlsx",
      init: {
        method: "GET",
      },
      timeoutMs: 180000,
    });
    const filename = generateFilename();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to export to Excel', details: String(error) },
      { status: 503 }
    );
  }
}
