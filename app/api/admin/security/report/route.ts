import { NextRequest, NextResponse } from 'next/server'
import { getSecurityDashboardStats } from '@/lib/policy-engine'

/**
 * GET /api/admin/security/report
 * Returns dashboard stats and optionally a CSV export.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const format = searchParams.get('format') ?? 'json'

        const stats = await getSecurityDashboardStats()

        if (format === 'csv') {
            const csvRows = [
                'metric,value',
                `total_sessions,${stats.totalSessions}`,
                `active_sessions,${stats.activeSessions}`,
                `revoked_sessions,${stats.revokedSessions}`,
                `warns,${stats.warns}`,
                `step_ups,${stats.stepUps}`,
                `revokes,${stats.revokes}`,
            ]
            return new NextResponse(csvRows.join('\n'), {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="security_report_${Date.now()}.csv"`,
                },
            })
        }

        return NextResponse.json({ success: true, ...stats })
    } catch (error) {
        console.error('GET /api/admin/security/report error:', error)
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
    }
}
