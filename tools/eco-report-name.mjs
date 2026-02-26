import { promises as fs } from 'node:fs';
import path from 'node:path';

async function getReportName(phase = 'A3.1') {
    const today = new Date().toISOString().split('T')[0];
    const reportsDir = path.join(process.cwd(), 'reports');

    // Ensure dir exists
    await fs.mkdir(reportsDir, { recursive: true });

    return path.join(reportsDir, `${today}__eco__state-of-nation__${phase.replace('.', '_')}.md`);
}

// If run directly
if (process.argv[1] === import.meta.url) {
    getReportName().then(console.log);
}

export { getReportName };
